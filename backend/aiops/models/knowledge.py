from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class KnowledgeBaseArticle(TimeStampedModel, TenantScopedModel):
    title = models.CharField(max_length=255)
    knowledge_type = models.CharField(max_length=50)  # howto, faq, troubleshooting
    difficulty_level = models.CharField(max_length=50, default="medium")
    content = models.TextField()
    applicable_work_types = models.JSONField(default=list)
    tags = models.JSONField(default=list)
    view_count = models.IntegerField(default=0)

class KnowledgeFeedback(TimeStampedModel, TenantScopedModel):
    article = models.ForeignKey(KnowledgeBaseArticle, related_name="feedback", on_delete=models.CASCADE)
    user = models.UUIDField(null=True, blank=True)
    rating = models.IntegerField()
    comment = models.TextField(blank=True)
