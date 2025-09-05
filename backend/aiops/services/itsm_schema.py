# Defines SLA targets and valid status transitions
ITSM_SCHEMA = {
    "incident": {
        "statuses": ["new", "in_progress", "resolved", "closed"],
        "sla": {"priority_1": 60, "priority_2": 120, "priority_3": 240},
    },
    "request": {
        "statuses": ["new", "in_progress", "fulfilled", "closed"],
        "sla": {"standard": 480},
    },
    "problem": {
        "statuses": ["new", "analysis", "resolved", "closed"],
        "sla": {"default": 1440},
    },
}

def validate_status(work_type, status):
    allowed = ITSM_SCHEMA.get(work_type, {}).get("statuses", [])
    return status in allowed

def get_sla_target(work_type, priority=None):
    schema = ITSM_SCHEMA.get(work_type, {}).get("sla", {})
    if priority and priority in schema:
        return schema[priority]
    if "default" in schema:
        return schema["default"]
    return None
