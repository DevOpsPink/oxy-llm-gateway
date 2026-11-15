from workers.cost_anomaly_detector import _determine_severity, THRESHOLD_WARNING, THRESHOLD_SUSPEND


def test_cost_spike_triggers_suspend_at_threshold():
    sev = _determine_severity(THRESHOLD_SUSPEND)
    assert sev == "CRITICAL_SUSPEND"


def test_cost_spike_below_threshold_warns_only():
    sev = _determine_severity(THRESHOLD_WARNING + 0.1)
    assert sev == "WARNING"

    none = _determine_severity(THRESHOLD_WARNING - 0.1)
    assert none is None
