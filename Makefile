test-core:
	sh scripts/test_core.sh

test-integration:
	sh scripts/test_integration.sh

dev-full:
	sh scripts/dev_full.sh

dev-quick:
	sh scripts/dev_quick.sh

dev-menu:
	sh scripts/oxy_dev_menu.sh

validate-features:
	./.venv/bin/python scripts/validate_feature_matrix.py

lint-features:
	python3 scripts/validate_feature_matrix.py && python3 scripts/lint_sla_language.py

