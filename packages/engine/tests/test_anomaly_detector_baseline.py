from workers.anomaly_detector import _breaches_threshold, _rolling_mean


def test_spike_triggers_anomaly_against_mean_baseline():
    series = [1.0, 1.2, 0.9, 1.1, 5.0]  # last point is spike
    baseline = _rolling_mean(series[:-1])

    assert _breaches_threshold(series[-1], baseline, multiplier=3.0) is True


def test_noise_does_not_trigger_anomaly():
    series = [1.0, 1.1, 0.95, 1.05, 2.0]  # 2x but below 3x threshold
    baseline = _rolling_mean(series[:-1])

    assert _breaches_threshold(series[-1], baseline, multiplier=3.0) is False
