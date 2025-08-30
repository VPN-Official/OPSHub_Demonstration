from django.test import TestCase
from aiops.models.workitems import WorkItem
from aiops.services.itsm_schema import validate_status

class WorkItemModelTest(TestCase):
    def test_status_validation(self):
        wi = WorkItem.objects.create(
            title="Test Incident",
            description="Sample",
            work_type="incident",
            status="new",
            priority="priority_1",
            sla_target_minutes=60,
        )
        self.assertTrue(validate_status("incident", wi.status))
        self.assertFalse(validate_status("incident", "foo"))
