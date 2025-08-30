from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.services import BusinessService
from ..serializers.services import BusinessServiceSerializer

class BusinessServiceViewSet(viewsets.ModelViewSet):
    queryset = BusinessService.objects.all()
    serializer_class = BusinessServiceSerializer

    @action(detail=True, methods=["get"])
    def risk_impact(self, request, pk=None):
        service = self.get_object()
        risks = service.risks.all()
        score = 0
        for r in risks:
            prob = {"low": 1, "medium": 2, "high": 3}[r.probability]
            imp = {"low": 1, "medium": 2, "high": 3}[r.impact]
            score += prob * imp
        return Response({"risk_score": score})
