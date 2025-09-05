from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.automation import (
    AutomationRule, AutomationTriggerCondition, AutomationExecutionStep, AutomationExecutionLog
)
from ..serializers.automation import (
    AutomationRuleSerializer, AutomationTriggerConditionSerializer,
    AutomationExecutionStepSerializer, AutomationExecutionLogSerializer
)
from ..services.automation_engine import is_work_item_eligible_for_automation
from ..models.workitems import WorkItem

class AutomationRuleViewSet(viewsets.ModelViewSet):
    queryset = AutomationRule.objects.all()
    serializer_class = AutomationRuleSerializer

    @action(detail=True, methods=["get"])
    def eligible_workitems(self, request, pk=None):
        rule = self.get_object()
        eligible = []
        for wi in WorkItem.objects.all():
            if is_work_item_eligible_for_automation(wi, rule):
                eligible.append({"id": wi.id, "title": wi.title})
        return Response({"eligible_workitems": eligible})

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        rule = self.get_object()
        work_item_id = request.data.get("work_item_id")
        wi = WorkItem.objects.get(id=work_item_id)
        log = AutomationExecutionLog.objects.create(
            rule=rule,
            work_item=wi,
            status="success",
            execution_time=1.2,
            result={"message": f"Rule {rule.name} executed"}
        )
        return Response(AutomationExecutionLogSerializer(log).data)

class AutomationTriggerConditionViewSet(viewsets.ModelViewSet):
    queryset = AutomationTriggerCondition.objects.all()
    serializer_class = AutomationTriggerConditionSerializer

class AutomationExecutionStepViewSet(viewsets.ModelViewSet):
    queryset = AutomationExecutionStep.objects.all()
    serializer_class = AutomationExecutionStepSerializer

class AutomationExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AutomationExecutionLog.objects.all()
    serializer_class = AutomationExecutionLogSerializer
