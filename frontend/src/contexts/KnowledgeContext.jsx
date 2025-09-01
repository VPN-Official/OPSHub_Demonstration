import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const KnowledgeContext = createContext();

export function KnowledgeProvider({ children }) {
  const [knowledge, setKnowledge] = useState([]);

  async function load() {
    const items = await getAll("knowledge");
    if (!items.length) {
      await seedAll({ knowledge: [] });
    }
    setKnowledge(items);
  }

  async function addArticle(article) {
    await setItem("knowledge", article);
    load();
  }

  async function removeArticle(id) {
    await delItem("knowledge", id);
    load();
  }

  async function clearAll() {
    await clearStore("knowledge");
    load();
  }

  useEffect(() => {
    load();
  }, []);

const roleView = knowledge; // Add this line
const articles = knowledge;  // IntelligenceCenter expects 'articles'

  return (
    <KnowledgeContext.Provider
      value={{ knowledge, articles, addArticle, removeArticle, clearAll, roleView }}
    >
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  return useContext(KnowledgeContext);
}