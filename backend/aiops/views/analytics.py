from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg, Sum
from datetime import timedelta, datetime
from ..models.analytics import AnalyticsMetric, FinancialImpact
from ..serializers.analytics import AnalyticsMetricSerializer, FinancialImpactSerializer

class AnalyticsMetricViewSet(viewsets.ModelViewSet):
    queryset = AnalyticsMetric.objects.all().order_by("-recorded_at")
    serializer_class = AnalyticsMetricSerializer

    @action(detail=False, methods=["get"])
    def aggregate(self, request):
        name = request.query_params.get("name")
        qs = self.queryset
        if name:
            qs = qs.filter(name=name)
        avg_val = qs.aggregate(avg=Avg("value"))["avg"]
        sum_val = qs.aggregate(sum=Sum("value"))["sum"]
        return Response({"name": name, "average": avg_val, "sum": sum_val})

    @action(detail=False, methods=["get"])
    def trend(self, request):
        name = request.query_params.get("name")
        cutoff = datetime.now() - timedelta(days=30)
        qs = self.queryset.filter(name=name, recorded_at__gte=cutoff).order_by("recorded_at")
        return Response(AnalyticsMetricSerializer(qs, many=True).data)

class FinancialImpactViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinancialImpact.objects.all()
    serializer_class = FinancialImpactSerializer

    @action(detail=False, methods=["get"])
    def totals(self, request):
        qs = self.queryset
        totals = {
            "estimated_cost": qs.aggregate(Sum("estimated_cost"))["estimated_cost__sum"] or 0,
            "actual_cost": qs.aggregate(Sum("actual_cost"))["actual_cost__sum"] or 0,
            "penalty_applied": qs.aggregate(Sum("penalty_applied"))["penalty_applied__sum"] or 0,
            "revenue_loss": qs.aggregate(Sum("revenue_loss"))["revenue_loss__sum"] or 0,
            "billable_hours": qs.aggregate(Sum("billable_hours"))["billable_hours__sum"] or 0,
        }
        return Response(totals)
