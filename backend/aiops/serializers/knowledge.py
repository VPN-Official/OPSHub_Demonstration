from rest_framework import serializers
from ..models.knowledge import KnowledgeBaseArticle, KnowledgeFeedback

class KnowledgeFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeFeedback
        fields = "__all__"

class KnowledgeBaseArticleSerializer(serializers.ModelSerializer):
    feedback = KnowledgeFeedbackSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgeBaseArticle
        fields = "__all__"
