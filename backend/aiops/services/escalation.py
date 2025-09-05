# Escalation logic

ESCALATION_MATRIX = {
    "priority_1": {"threshold": 60, "target": "team:incident_managers"},
    "priority_2": {"threshold": 180, "target": "team:service_desk"},
    "priority_3": {"threshold": 360, "target": "team:operations"},
}

def get_escalation_target(priority, work_type, elapsed_minutes):
    rule = ESCALATION_MATRIX.get(priority)
    if rule and elapsed_minutes > rule["threshold"]:
        return rule["target"]
    return None
