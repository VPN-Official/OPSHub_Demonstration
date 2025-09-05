# Automation eligibility + step runner
from ..models.automation import AutomationRule, AutomationTriggerCondition

def is_work_item_eligible_for_automation(work_item, rule: AutomationRule):
    for cond in rule.trigger_conditions.all():
        if cond.work_types and work_item.work_type not in cond.work_types:
            return False
        if cond.asset_types and (not work_item.asset or work_item.asset.asset_type not in cond.asset_types):
            return False
        if cond.keywords:
            if not any(kw.lower() in (work_item.title.lower() + work_item.description.lower()) for kw in cond.keywords):
                return False
    return True

def run_execution_steps(rule, work_item):
    results = []
    for step in rule.execution_steps.order_by("order"):
        results.append({
            "action": step.action,
            "params": step.params,
            "status": "success"  # placeholder, integrate with real runner
        })
    return results
