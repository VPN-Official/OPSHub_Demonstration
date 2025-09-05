from django.contrib import admin
from .models.workitems import WorkItem
from .models.assets import Asset
from .models.services import BusinessService
from .models.knowledge import KnowledgeBaseArticle

@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "priority", "work_type", "created_at")

@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "asset_type", "status", "criticality")

@admin.register(BusinessService)
class BusinessServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "criticality", "revenue_impact_per_hour")

@admin.register(KnowledgeBaseArticle)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "knowledge_type", "difficulty_level", "view_count")
