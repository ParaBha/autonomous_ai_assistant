import sys
import io
import contextlib
import traceback
import os
import matplotlib.pyplot as plt
import pandas as pd
from typing import Dict, Any, Optional

class PythonExecutor:
    """
    A service to execute Python code in a controlled environment.
    Note: For a production environment, this should be isolated in a docker container or similar sandbox.
    """
    
    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def execute(self, code: str) -> Dict[str, Any]:
        """
        Executes the provided Python code and captures stdout, stderr, and any generated plots.
        """
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # Prepare the execution environment
        # We allow access to pandas and matplotlib as requested
        local_vars = {
            "pd": pd,
            "plt": plt,
            "os": os
        }
        
        result = {
            "output": "",
            "error": None,
            "files": []
        }

        try:
            with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
                # We use exec to run the code
                exec(code, {}, local_vars)
                
                # Check for any generated plots if plt.show() wasn't called or to capture them
                if plt.get_fignums():
                    plot_path = os.path.join(self.output_dir, f"plot_{len(os.listdir(self.output_dir))}.png")
                    plt.savefig(plot_path)
                    plt.close('all')
                    result["files"].append(plot_path)
            
            result["output"] = stdout_capture.getvalue()
            result["error"] = stderr_capture.getvalue() if stderr_capture.getvalue() else None
            
        except Exception:
            result["error"] = traceback.format_exc()
            
        return result

python_executor = PythonExecutor()
