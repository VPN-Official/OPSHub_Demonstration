from rest_framework.routers import DefaultRouter
from django.urls import path
from .views.workitems import WorkItemViewSet
from .views.assets import AssetViewSet
from .views.services import BusinessServiceViewSet
from .views.automation import (
    AutomationRuleViewSet, AutomationTriggerConditionViewSet, AutomationExecutionStepViewSet, AutomationExecutionLogViewSet
)
from .views.knowledge import KnowledgeBaseArticleViewSet, KnowledgeFeedbackViewSet
from .views.logs import SystemLogViewSet, SystemLogCorrelationViewSet
from .views.governance import OperationalCategoryViewSet, ChangeRequestViewSet, RiskRegisterViewSet
from .views.analytics import AnalyticsMetricViewSet, FinancialImpactViewSet
from .views.people import ExternalUserViewSet, TeamViewSet, TeamMembershipViewSet
from .views.customers import CustomerViewSet, ContractViewSet, VendorViewSet
from .views.orchestration import RunSLAChecksView, NotifyEscalationView, RunComplianceChecksView, RunMetricRollupView

router = DefaultRouter()
router.register(r'workitems', WorkItemViewSet)
router.register(r'assets', AssetViewSet)
router.register(r'services', BusinessServiceViewSet)
router.register(r'automation/rules', AutomationRuleViewSet)
router.register(r'automation/triggers', AutomationTriggerConditionViewSet)
router.register(r'automation/steps', AutomationExecutionStepViewSet)
router.register(r'automation/logs', AutomationExecutionLogViewSet)
router.register(r'kb', KnowledgeBaseArticleViewSet)
router.register(r'kb-feedback', KnowledgeFeedbackViewSet)
router.register(r'logs', SystemLogViewSet)
router.register(r'log-correlations', SystemLogCorrelationViewSet)
router.register(r'governance/categories', OperationalCategoryViewSet)
router.register(r'governance/change-requests', ChangeRequestViewSet)
router.register(r'governance/risks', RiskRegisterViewSet)
router.register(r'analytics/metrics', AnalyticsMetricViewSet)
router.register(r'analytics/financial-impact', FinancialImpactViewSet)
router.register(r'people/users', ExternalUserViewSet)
router.register(r'people/teams', TeamViewSet)
router.register(r'people/memberships', TeamMembershipViewSet)
router.register(r'customers', CustomerViewSet)
router.register(r'contracts', ContractViewSet)
router.register(r'vendors', VendorViewSet)

urlpatterns = router.urls + [
    path("orchestration/run-sla-checks/", RunSLAChecksView.as_view()),
    path("orchestration/notify-escalation/", NotifyEscalationView.as_view()),
    path("orchestration/run-compliance-checks/", RunComplianceChecksView.as_view()),
    path("orchestration/run-metric-rollup/", RunMetricRollupView.as_view()),
]
