# File overview: Application module logic for tests/conftest.py.
"""
Ensure backend settings validate during pytest even if a developer .env has a short JWT secret.
Set PYTEST_KEEP_USER_JWT=1 to use your real JWT_SECRET_KEY from the environment instead.
"""

import os

if not os.environ.get("PYTEST_KEEP_USER_JWT"):
    os.environ["JWT_SECRET_KEY"] = "pytest-jwt-secret-key-min-16"
