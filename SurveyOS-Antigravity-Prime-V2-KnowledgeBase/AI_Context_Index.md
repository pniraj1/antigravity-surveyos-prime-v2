# AI Context Index

> **AI INSTRUCTION**: Read this file first when entering a new session if you need to understand the project architecture without burning tokens scanning the whole filesystem.

## Rules for AI Token Optimization
1. **Never scan the whole src/ folder.** Find the component you need via `[[00_Project_Map]]` first.
2. **Use the Knowledge Graph:** Always use `semantic_search_nodes` or `query_graph` MCP tools before falling back to manual grep.
3. **Save State before Resetting:** If your token usage gets high, summarize your thoughts into `[[Tasks]]` and tell the user to reset the conversation.
4. **Distill Insights:** When you solve a difficult bug or complex logic, write a brief explanation into the `Patterns/` or `Modules/` folders in this vault. Do not make the human explain it again later.

## Vault Mapping
- **Status & Todos:** See `[[Tasks]]`
- **Project Structure & Rules:** See `[[01_Architecture_and_Status]]` and `[[00_Project_Map]]`
- **Data Dictionary:** See `[[Data_Dictionary_and_Flow]]`
- **User Personas:** See `[[Surveyor_User_Manual]]` and `[[Claim_Lifecycle_Workflow]]`
- **AI Tooling rules:** See `[[ANTIGRAVITY_BIBLE]]`
