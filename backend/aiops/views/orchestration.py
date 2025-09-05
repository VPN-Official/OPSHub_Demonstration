from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..tasks.sla_checks import run_sla_checks
from ..tasks.escalation_jobs import notify_escalation
from ..tasks.compliance_checks import run_compliance_checks
from ..tasks.metric_rollups import daily_rollup

class RunSLAChecksView(APIView):
    def post(self, request):
        result = run_sla_checks()
        return Response({"alerts": result}, status=status.HTTP_200_OK)

class NotifyEscalationView(APIView):
    def post(self, request):
        work_item_id = request.data.get("work_item_id")
        target = request.data.get("escalation_target")
        if not (work_item_id and target):
            return Response({"error": "work_item_id and escalation_target required"}, status=400)
        notify_escalation(work_item_id, target)
        return Response({"message": f"Escalation triggered for WorkItem {work_item_id} → {target}"})

class RunComplianceChecksView(APIView):
    def post(self, request):
        result = run_compliance_checks()
        return Response({"expired": result}, status=status.HTTP_200_OK)

class RunMetricRollupView(APIView):
    def post(self, request):
        daily_rollup()
        return Response({"message": "Metric rollup triggered"}, status=status.HTTP_200_OK)
