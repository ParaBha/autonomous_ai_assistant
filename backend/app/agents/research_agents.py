from typing import List, Dict, Any, Annotated, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from app.core.config import settings
from app.services.python_executor import python_executor
import json

class AgentState(TypedDict):
    task: str
    plan: Dict[str, Any]
    analysis: List[Dict[str, Any]]
    insights: List[str]
    gaps: List[str]
    study_material: Dict[str, Any]
    code_execution: Dict[str, Any]

class ResearchAgents:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            max_retries=3,
        )

    def _get_content(self, response) -> str:
        if isinstance(response.content, str):
            return response.content
        if isinstance(response.content, list):
            return "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content])
        return str(response.content)

    async def planner_agent(self, state: AgentState) -> AgentState:
        prompt = f"""As a Research Planner, create a comprehensive, professional roadmap for the topic: {state['task']}. 
        The roadmap should be broken down into clear, logical phases.
        
        Return ONLY a JSON object with the following structure:
        {{
          "roadmap": [
            {{
              "title": "Phase Title",
              "description": "Short description of what happens in this phase",
              "duration": "Estimated time (e.g., Day 1-2, Week 1, etc.)"
            }}
          ]
        }}
        Do NOT include any other text before or after the JSON block.
        """
        response = self.llm.invoke(prompt)
        try:
            content = self._get_content(response).strip()
            # Clean up potential markdown code blocks
            if content.startswith("```"):
                lines = content.split('\n')
                if len(lines) > 2:
                    content = '\n'.join(lines[1:-1])
                else:
                    content = content.replace("```json", "").replace("```", "").strip()
            
            plan_data = json.loads(content)
            state["plan"] = plan_data
        except Exception as e:
            # Fallback for old format or if JSON fails
            state["plan"] = {"roadmap": self._get_content(response)}
        
        return state

    async def analyst_agent(self, state: AgentState) -> AgentState:
        prompt = f"Analyze the following research task: {state['task']}. Summarize key points and concepts."
        response = self.llm.invoke(prompt)
        state["analysis"] = [{"summary": self._get_content(response)}]
        return state

    async def data_analyst_agent(self, state: AgentState) -> AgentState:
        """
        Agent that performs data analysis using Python.
        """
        prompt = f"""You are a Data Analyst for a research project on: {state['task']}.
        Based on the task, write a brief Python script to generate some mock data using pandas and create a simple visualization using matplotlib.
        The script should print the head of the dataframe.
        Return ONLY the python code inside a JSON block like this:
        {{"code": "import pandas as pd\\nimport matplotlib.pyplot as plt\\n..."}}
        """
        response = self.llm.invoke(prompt)
        try:
            content = self._get_content(response).strip()
            # Clean up potential markdown code blocks
            if content.startswith("```"):
                lines = content.split('\n')
                if len(lines) > 2:
                    content = '\n'.join(lines[1:-1])
                else:
                    content = content.replace("```json", "").replace("```python", "").replace("```", "").strip()
            
            data = json.loads(content)
            code = data.get("code", "")
            if code:
                exec_result = python_executor.execute(code)
                state["code_execution"] = exec_result
                state["analysis"].append({
                    "data_analysis_output": exec_result["output"],
                    "generated_files": exec_result["files"]
                })
        except Exception as e:
            state["code_execution"] = {"error": str(e)}
        
        return state

    async def insight_generator(self, state: AgentState) -> AgentState:
        prompt = f"Based on the analysis {state['analysis']}, generate key insights and hidden patterns."
        response = self.llm.invoke(prompt)
        state["insights"] = [str(response.content)]
        return state

    async def gap_analyzer(self, state: AgentState) -> AgentState:
        prompt = "Identify research gaps and underexplored areas based on the current findings."
        response = self.llm.invoke(prompt)
        state["gaps"] = [str(response.content)]
        return state

    async def study_assistant(self, state: AgentState) -> AgentState:
        prompt = "Generate study materials like flashcards and MCQs based on the research content."
        response = self.llm.invoke(prompt)
        state["study_material"] = {"content": str(response.content)}
        return state

    def create_graph(self):
        workflow = StateGraph(AgentState)
        
        workflow.add_node("planner", self.planner_agent)
        workflow.add_node("analyst", self.analyst_agent)
        workflow.add_node("data_analyst", self.data_analyst_agent)
        workflow.add_node("insight", self.insight_generator)
        workflow.add_node("gap", self.gap_analyzer)
        workflow.add_node("study", self.study_assistant)
        
        workflow.set_entry_point("planner")
        workflow.add_edge("planner", "analyst")
        workflow.add_edge("analyst", "data_analyst")
        workflow.add_edge("data_analyst", "insight")
        workflow.add_edge("insight", "gap")
        workflow.add_edge("gap", "study")
        workflow.add_edge("study", END)
        
        return workflow.compile()

research_agents = ResearchAgents()
research_graph = research_agents.create_graph()
