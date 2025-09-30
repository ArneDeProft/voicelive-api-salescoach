#!/usr/bin/env python3

"""Simple test script to verify predefined agent functionality."""

import os
import sys
from pathlib import Path

# Add the backend src directory to the path
backend_src = Path(__file__).parent / "backend" / "src"
sys.path.append(str(backend_src))

from src.app import app

def test_config_with_predefined_agent():
    """Test configuration with predefined agent."""
    # Set environment variable for testing
    os.environ["AGENT_ID"] = "test-predefined-agent"

    # Reload config to pick up the environment variable
    from importlib import reload
    from src import config as config_module
    reload(config_module)

    # Get the config
    test_config = config_module.config

    print(f"Config agent_id: {test_config.get('agent_id')}")
    print(f"Has predefined agent: {bool(test_config.get('agent_id'))}")

    # Test Flask app
    with app.test_client() as client:
        response = client.get('/api/config')
        data = response.get_json()

        print(f"API response: {data}")

        # Verify the response includes predefined agent info
        assert data['has_predefined_agent'] == True
        assert data['predefined_agent_id'] == "test-predefined-agent"

        print("✅ Test passed: Predefined agent configuration works correctly")

def test_config_without_predefined_agent():
    """Test configuration without predefined agent."""
    # Remove environment variable
    if "AGENT_ID" in os.environ:
        del os.environ["AGENT_ID"]

    # Reload config to pick up the change
    from importlib import reload
    from src import config as config_module
    reload(config_module)

    # Get the config
    test_config = config_module.config

    print(f"Config agent_id: {test_config.get('agent_id')}")
    print(f"Has predefined agent: {bool(test_config.get('agent_id'))}")

    # Test Flask app
    with app.test_client() as client:
        response = client.get('/api/config')
        data = response.get_json()

        print(f"API response: {data}")

        # Verify the response indicates no predefined agent
        assert data['has_predefined_agent'] == False
        assert data['predefined_agent_id'] == ""

        print("✅ Test passed: No predefined agent configuration works correctly")

if __name__ == "__main__":
    print("Testing predefined agent functionality...")

    try:
        test_config_with_predefined_agent()
        print()
        test_config_without_predefined_agent()
        print("\n🎉 All tests passed! Predefined agent feature is working correctly.")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)