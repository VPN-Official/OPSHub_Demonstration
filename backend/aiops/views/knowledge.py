from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg
from ..models.knowledge import KnowledgeBaseArticle, KnowledgeFeedback
from ..serializers.knowledge import KnowledgeBaseArticleSerializer, KnowledgeFeedbackSerializer

class KnowledgeBaseArticleViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeBaseArticle.objects.all()
    serializer_class = KnowledgeBaseArticleSerializer

    @action(detail=False, methods=["get"])
    def search(self, request):
        qs = self.queryset
        work_type = request.query_params.get("work_type")
        keyword = request.query_params.get("keyword")
        if work_type:
            qs = qs.filter(applicable_work_types__contains=[work_type])
        if keyword:
            qs = qs.filter(title__icontains=keyword) | qs.filter(content__icontains=keyword)
        return Response(KnowledgeBaseArticleSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        article = self.get_object()
        avg_rating = article.feedback.aggregate(Avg("rating"))["rating__avg"]
        return Response({
            "view_count": article.view_count,
            "feedback_count": article.feedback.count(),
            "average_rating": round(avg_rating or 0, 2)
        })

class KnowledgeFeedbackViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeFeedback.objects.all()
    serializer_class = KnowledgeFeedbackSerializer
