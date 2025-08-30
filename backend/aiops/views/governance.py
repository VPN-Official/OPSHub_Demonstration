from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import date
from ..models.governance import OperationalCategory, ChangeRequest, RiskRegister
from ..serializers.governance import OperationalCategorySerializer, ChangeRequestSerializer, RiskRegisterSerializer

class OperationalCategoryViewSet(viewsets.ModelViewSet):
    queryset = OperationalCategory.objects.all()
    serializer_class = OperationalCategorySerializer

    @action(detail=True, methods=["get"])
    def sla_overrides(self, request, pk=None):
        category = self.get_object()
        return Response(category.sla_override or {})

class ChangeRequestViewSet(viewsets.ModelViewSet):
    queryset = ChangeRequest.objects.all()
    serializer_class = ChangeRequestSerializer

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        qs = self.queryset.filter(scheduled_start__gte=date.today()).order_by("scheduled_start")
        return Response(ChangeRequestSerializer(qs, many=True).data)

class RiskRegisterViewSet(viewsets.ModelViewSet):
    queryset = RiskRegister.objects.all()
    serializer_class = RiskRegisterSerializer

    @action(detail=False, methods=["get"])
    def open_risks(self, request):
        qs = self.queryset.filter(status="open")
        return Response({"open_count": qs.count(), "risks": RiskRegisterSerializer(qs, many=True).data})

    @action(detail=True, methods=["get"])
    def score(self, request, pk=None):
        risk = self.get_object()
        prob = {"low": 1, "medium": 2, "high": 3}[risk.probability]
        imp = {"low": 1, "medium": 2, "high": 3}[risk.impact]
        return Response({"score": prob * imp})
