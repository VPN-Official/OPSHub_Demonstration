from datetime import datetime, timezone

def calculate_smart_score(workitem, current_user_id=None):
    """
    Calculate Smart Score for a WorkItem.
    workitem: dict-like object with keys priority, sla_target_minutes, created_at, modified_at, business_service, automation, assigned_to
    """
    score = 0

    # 1. Priority Weight
    priority_map = {
        "priority_1": 400,
        "priority_2": 300,
        "priority_3": 200,
        "priority_4": 100,
    }
    score += priority_map.get(workitem.get("priority"), 0)

    # 2. SLA Urgency
    sla_target = workitem.get("sla_target_minutes")
    created_at = workitem.get("created_at")
    modified_at = workitem.get("modified_at") or datetime.now(timezone.utc)

    if sla_target and created_at:
        elapsed = (modified_at - created_at).total_seconds() / 60
        remaining = sla_target - elapsed

        if remaining <= 0:
            score += 300
        elif remaining <= 15:
            score += 250
        elif remaining <= 30:
            score += 200
        elif remaining <= 60:
            score += 100

    # 3. Business Impact
    revenue = (
        workitem.get("business_service", {}).get("revenue_impact_per_hour")
        if workitem.get("business_service")
        else None
    )
    if revenue:
        impact = float(revenue)
        score += min(int(impact / 100000) * 50, 200)

    # 4. Automation Eligibility
    automation = workitem.get("automation")
    if automation:
        if automation.get("success_rate", 0) > 80 and automation.get("auto_executable", False):
            score += 100
        elif automation.get("eligible"):
            score += 50

    # 5. Assignment Context
    assigned_to = workitem.get("assigned_to")
    if assigned_to:
        if current_user_id and assigned_to.get("id") == current_user_id:
            score += 75
        elif assigned_to.get("team"):
            score += 50

    return score
