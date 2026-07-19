# AIChat Repository Instructions

## Project identity

- Repository and engineering project name: `aichat`.
- Java base package: `com.aichat`.
- Maven artifact: `aichat-server`.
- Product name: `关系清晰卡`; do not confuse the product name with the engineering project name.
- This repository is independent. Never write AIChat product assets into the sibling `fengshui` repository.

## Contract workflow

- Edit business paths and schemas in `contracts/openapi.yaml`.
- Edit centralized authentication and operator RBAC only in `contracts/auth-rules.yaml`.
- Do not add operation-level auth fields to the authoring OpenAPI.
- Regenerate `contracts/openapi.generated.json`, Spring controllers, and the mini-program client after contract changes.
- Run the commands documented in `README.md` before handing off changes.

## Safety boundary

- Preserve unrelated user changes and never permanently delete project files.
- Resource ownership and entitlements must be enforced in domain application services; URL auth classification alone is insufficient.
- Do not commit, push, publish, deploy, or enable real payments without explicit authorization.
