from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from ..models.logs import SystemLog, SystemLogCorrelation
from ..serializers.logs import SystemLogSerializer, SystemLogCorrelationSerializer

class SystemLogViewSet(viewsets.ModelViewSet):
    queryset = SystemLog.objects.all().order_by("-timestamp")
    serializer_class = SystemLogSerializer

    @action(detail=False, methods=["get"])
    def stats(self, request):
        counts_by_level = SystemLog.objects.values("level").annotate(total=Count("id"))
        counts_by_category = SystemLog.objects.values("category").annotate(total=Count("id"))
        return Response({"by_level": list(counts_by_level), "by_category": list(counts_by_category)})

class SystemLogCorrelationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemLogCorrelation.objects.all()
    serializer_class = SystemLogCorrelationSerializer

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        correlation = self.get_object()
        logs = SystemLog.objects.filter(correlation_id=correlation.correlation_id).order_by("timestamp")
        return Response(SystemLogSerializer(logs, many=True).data)
