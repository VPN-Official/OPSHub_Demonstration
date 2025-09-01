import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const KnowledgeContext = createContext();

export function KnowledgeProvider({ children }) {
  const [knowledge, setKnowledge] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    views: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("knowledge");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Knowledge store empty, but global seeding will handle this");
        }
      }
      
      setKnowledge(items);
      calculateStats(items);
    } catch (error) {
      console.error("Failed to load knowledge:", error);
      setKnowledge([]);
      setStats({ total: 0, published: 0, draft: 0, views: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    const published = items.filter(item => item.status === "published").length;
    const draft = items.filter(item => item.status === "draft").length;
    const views = items.reduce((sum, item) => sum + (item.view_count || 0), 0);

    setStats({
      total,
      published,
      draft,
      views
    });
  }

  async function addArticle(article) {
    try {
      const newArticle = {
        ...article,
        id: article.id || `kb_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        status: article.status || "draft",
        view_count: 0,
        helpful_count: 0,
        last_modified: Date.now(),
        version: "1.0",
        tags: article.tags || []
      };
      
      await setItem("knowledge", newArticle);
      await load();
    } catch (error) {
      console.error("Failed to add article:", error);
      throw error;
    }
  }

  async function updateArticle(id, updates) {
    try {
      const existing = knowledge.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        // Version management for significant content changes
        if (updates.content && updates.content !== existing.content) {
          const currentVersion = parseFloat(existing.version || "1.0");
          updated.version = (currentVersion + 0.1).toFixed(1);
        }
        
        await setItem("knowledge", updated);
        
        // Optimistic update
        setKnowledge(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newKnowledge = knowledge.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newKnowledge);
      }
    } catch (error) {
      console.error("Failed to update article:", error);
      await load();
      throw error;
    }
  }

  async function removeArticle(id) {
    try {
      await delItem("knowledge", id);
      await load();
    } catch (error) {
      console.error("Failed to remove article:", error);
      throw error;
    }
  }

  async function viewArticle(id) {
    try {
      const article = knowledge.find(item => item.id === id);
      if (article) {
        const updates = {
          view_count: (article.view_count || 0) + 1,
          last_viewed: Date.now(),
          last_viewed_by: user?.id || "anonymous"
        };
        
        await updateArticle(id, updates);
      }
    } catch (error) {
      console.error("Failed to record article view:", error);
    }
  }

  async function rateArticle(id, helpful = true) {
    try {
      const article = knowledge.find(item => item.id === id);
      if (article) {
        const updates = helpful 
          ? { helpful_count: (article.helpful_count || 0) + 1 }
          : { unhelpful_count: (article.unhelpful_count || 0) + 1 };
        
        updates.last_rated = Date.now();
        updates.last_rated_by = user?.id || "anonymous";
        
        await updateArticle(id, updates);
      }
    } catch (error) {
      console.error("Failed to rate article:", error);
      throw error;
    }
  }

  async function publishArticle(id) {
    try {
      await updateArticle(id, {
        status: "published",
        published_at: Date.now(),
        published_by: user?.id || "system"
      });
    } catch (error) {
      console.error("Failed to publish article:", error);
      throw error;
    }
  }

  async function searchKnowledge(query, filters = {}) {
    try {
      if (!query || query.trim() === "") {
        setSearchResults([]);
        return [];
      }

      const searchTerm = query.toLowerCase().trim();
      let results = roleView.filter(article => {
        // Search in title, content, tags, and category
        const searchableContent = [
          article.title,
          article.content,
          article.summary,
          article.category,
          ...(article.tags || [])
        ].join(' ').toLowerCase();

        return searchableContent.includes(searchTerm);
      });

      // Apply filters
      if (filters.category) {
        results = results.filter(article => article.category === filters.category);
      }
      
      if (filters.status) {
        results = results.filter(article => article.status === filters.status);
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(article => 
          filters.tags.some(tag => (article.tags || []).includes(tag))
        );
      }

      // Sort by relevance (simple scoring based on matches)
      results = results.sort((a, b) => {
        const aScore = calculateRelevanceScore(a, searchTerm);
        const bScore = calculateRelevanceScore(b, searchTerm);
        return bScore - aScore;
      });

      setSearchResults(results);
      return results;
    } catch (error) {
      console.error("Failed to search knowledge:", error);
      setSearchResults([]);
      return [];
    }
  }

  function calculateRelevanceScore(article, searchTerm) {
    let score = 0;
    const title = (article.title || '').toLowerCase();
    const content = (article.content || '').toLowerCase();
    const tags = (article.tags || []).join(' ').toLowerCase();

    // Title matches are weighted higher
    if (title.includes(searchTerm)) score += 10;
    
    // Tag matches are also important
    if (tags.includes(searchTerm)) score += 5;
    
    // Content matches
    const contentMatches = (content.match(new RegExp(searchTerm, 'g')) || []).length;
    score += contentMatches;

    // Boost for recent articles
    const daysSinceCreated = (Date.now() - (article.created_at || 0)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) score += 2;

    // Boost for frequently viewed articles
    score += Math.min((article.view_count || 0) * 0.1, 5);

    return score;
  }

  async function clearAll() {
    try {
      await clearStore("knowledge");
      await load();
    } catch (error) {
      console.error("Failed to clear knowledge:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !knowledge.length) return knowledge;
    
    switch (user.role) {
      case "Automation Engineer":
      case "Manager":
        return knowledge; // See all knowledge including drafts
        
      case "SRE":
      case "Senior SRE":
        // See published articles + their own drafts + team drafts
        return knowledge.filter(article => 
          article.status === "published" ||
          article.created_by === user.id ||
          article.team_id === user.teamId
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // See published articles + their own drafts
        return knowledge.filter(article => 
          article.status === "published" ||
          article.created_by === user.id
        );
        
      default:
        return knowledge.filter(article => article.status === "published");
    }
  }, [knowledge, user]);

  // Compatibility alias for existing components
  const articles = roleView;

  // Get knowledge by category
  const getByCategory = useMemo(() => {
    const categorized = {};
    roleView.forEach(article => {
      const category = article.category || "uncategorized";
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(article);
    });
    return categorized;
  }, [roleView]);

  // Get popular articles
  const popularArticles = useMemo(() => {
    return roleView
      .filter(article => article.status === "published")
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 10);
  }, [roleView]);

  // Get recent articles
  const recentArticles = useMemo(() => {
    return roleView
      .filter(article => article.status === "published")
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 10);
  }, [roleView]);

  // Get user's draft articles
  const myDrafts = useMemo(() => {
    if (!user) return [];
    return roleView.filter(article => 
      article.status === "draft" && article.created_by === user.id
    );
  }, [roleView, user]);

  // Enhanced loading with retry logic
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (isMounted) {
            await load();
            break;
          }
        } catch (error) {
          console.error(`Knowledge load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All knowledge load attempts failed");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    loadWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = {
    knowledge,
    articles, // Compatibility alias
    roleView,
    isLoading,
    stats,
    searchResults,
    getByCategory,
    popularArticles,
    recentArticles,
    myDrafts,
    addArticle,
    updateArticle,
    removeArticle,
    viewArticle,
    rateArticle,
    publishArticle,
    searchKnowledge,
    clearAll,
    reload: load
  };

  return (
    <KnowledgeContext.Provider value={contextValue}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
}