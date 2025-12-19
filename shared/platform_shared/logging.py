"""
Structured JSON Logging

This module provides structured JSON logging for all services.
Benefits:
- Machine-readable logs (for CloudWatch, ELK, etc.)
- Consistent format across services
- Easy to query and filter
- Includes trace_id for distributed tracing

Why JSON?
- CloudWatch Logs Insights can query JSON
- ELK Stack works best with structured logs
- Easy to parse programmatically
- Better than plain text for production
"""

import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict, Optional


class JSONFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs as JSON.
    
    Each log entry includes:
    - timestamp: ISO 8601 format
    - level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - service: Service name
    - message: Log message
    - module: Python module name
    - function: Function name
    - line: Line number
    - extra_fields: Any additional fields from logger
    - exception: Exception traceback (if present)
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON string.
        
        Args:
            record: LogRecord from Python logging
            
        Returns:
            JSON string representation of log
        """
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "service": getattr(record, 'service_name', 'unknown'),
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields if present (passed via logger.info(..., extra={...}))
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        # Add trace_id if present (for distributed tracing)
        if hasattr(record, 'trace_id'):
            log_entry['trace_id'] = record.trace_id
        
        # Add correlation_id if present
        if hasattr(record, 'correlation_id'):
            log_entry['correlation_id'] = record.correlation_id
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)


def setup_logging(service_name: str, level: str = "INFO") -> logging.Logger:
    """
    Setup structured JSON logging for a service.
    
    This function:
    1. Creates a logger with the service name
    2. Sets up JSON formatter
    3. Adds service name to all log records
    4. Configures stdout handler
    
    Usage:
        logger = setup_logging("user-service", "INFO")
        logger.info("Service started")
        logger.error("Error occurred", extra={"error_code": 500})
    
    Args:
        service_name: Name of the service (e.g., "user-service")
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Prevent duplicate handlers (important for reloads)
    if logger.handlers:
        return logger
    
    # Create stdout handler
    handler = logging.StreamHandler(sys.stdout)
    formatter = JSONFormatter()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Add service name to all records
    old_factory = logging.getLogRecordFactory()
    
    def record_factory(*args, **kwargs):
        """
        Custom log record factory that adds service_name.
        
        This ensures every log record has the service name,
        even if not explicitly passed.
        """
        record = old_factory(*args, **kwargs)
        record.service_name = service_name
        return record
    
    logging.setLogRecordFactory(record_factory)
    
    return logger

