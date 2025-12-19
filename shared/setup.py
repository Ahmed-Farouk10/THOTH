"""
Setup script for platform-shared package.

This allows the shared package to be installed as a Python package,
making it importable from any service.

Installation:
    pip install -e ./shared

Or in Dockerfile:
    COPY ./shared /shared
    RUN pip install /shared
"""

from setuptools import setup, find_packages

setup(
    name="platform-shared",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "python-dotenv>=1.0.0",
    ],
)

