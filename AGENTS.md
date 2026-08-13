# **ARAM — Engineering Instructions for AI Coding Agents**

## **Product context**

Aram is an India focused legal information and resolution platform.

Users will describe real world legal problems in plain language. Aram should help them understand:

- what happened
- which parties are involved
- their possible legal rights
- their legal boundaries
- relevant Indian laws and regulations
- possible next actions
- the safest path toward resolution
- documents or actions required to proceed

Aram may later use AI agents to research, analyse, prepare documents and guide users through resolution workflows.

This is a high trust product. Security, privacy, traceability and accuracy are more important than development speed.

---

# **Core engineering principles**

## **1. Keep the architecture simple**

Prefer simple, readable and maintainable code.

Do not create unnecessary abstraction layers.

Do not introduce new frameworks, libraries or infrastructure unless they are genuinely necessary.

Before adding a major dependency, explain:

- why it is required
- what problem it solves
- what alternatives exist
- whether it creates security or maintenance risk

---

## **2. TypeScript first**

Use TypeScript throughout the application.

Avoid `any` unless absolutely unavoidable.

Prefer explicit types for:

- API responses
- database records
- user input
- agent outputs
- legal sources
- case information
- authentication data

---

# **Security rules**

## **3. Never expose secrets**

Never place API keys, database secrets, service credentials or private tokens inside:

- React components
- client side JavaScript
- public folders
- Git tracked files
- source code
- browser accessible environment variables

Secrets must be stored using environment variables.

Examples:

```text
ANTHROPIC_API_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Never commit `.env.local`.

---

## **4. Client and server separation**

Anything involving:

- AI provider credentials
- database administration
- privileged queries
- authentication secrets
- legal analysis
- document processing
- sensitive user information

must happen on the server.

Never expose privileged logic directly to the browser.

---

## **5. Treat all user input as untrusted**

Validate and sanitize all external input.

This includes:

- case descriptions
- uploaded documents
- filenames
- URLs
- legal queries
- contact information
- generated AI output

Do not directly execute, inject or trust user provided content.

---

## **6. Protect user case data**

Assume case data may contain highly sensitive information.

Design all storage and API access with strict user isolation.

A user must never be able to access another user’s case.

When database authentication is introduced, enforce access control at the database level wherever possible.

---

# **AI safety and architecture**

## **7. AI output is not automatically trusted**

Never treat model generated output as verified legal fact.

AI responses should be structured so Aram can distinguish:

- user supplied facts
- model inference
- retrieved legal information
- recommendations
- unresolved uncertainty

Do not silently convert assumptions into facts.

---

## **8. Legal information must be traceable**

When Aram eventually provides legal information, important legal claims should be traceable to authoritative sources.

Prefer sources such as:

- Indian legislation
- Government of India portals
- state government portals
- official court sources
- regulatory authorities
- gazette publications
- recognised legal databases where permitted

Do not invent:

- statutes
- sections
- judgments
- regulations
- government policies
- case citations

---

## **9. Separate reasoning stages**

Do not build one giant AI prompt that attempts to solve an entire case.

Prefer a staged system such as:

```text
Case intake
↓
Fact extraction
↓
Missing information detection
↓
Issue identification
↓
Legal research
↓
Rights and boundaries
↓
Resolution options
↓
Risk assessment
↓
Recommended next action
↓
Document/action generation
```

Each stage should produce structured outputs where practical.

---

## **10. Agents require boundaries**

Future AI agents must have clearly defined responsibilities.

An agent should only have access to tools and information required for its task.

Avoid giving every agent unrestricted access to:

- user data
- external APIs
- databases
- file systems
- administrative actions

Use least privilege by default.

---

# **Legal product principles**

## **11. Distinguish information from professional legal representation**

Aram should clearly communicate when it is:

- providing legal information
- identifying possible rights
- suggesting possible actions
- recommending professional legal assistance

Do not represent Aram as a lawyer unless the relevant workflow actually involves an authorised legal professional.

---

## **12. Do not give false certainty**

Avoid language that implies guaranteed legal outcomes.

Prefer explanations that clearly establish:

- what appears to apply
- why it may apply
- what information is missing
- what could change the conclusion
- what the safest next step is

---

## **13. Resolution oriented design**

Aram should not merely answer legal questions.

Where appropriate, structure the product around moving the user toward resolution.

Example:

```text
Problem
↓
Understand the situation
↓
Know your rights
↓
Understand your boundaries
↓
Evaluate possible routes
↓
Choose safest route
↓
Take action
↓
Track outcome
```

---

# **Database rules**

## **14. No destructive database changes without approval**

Never automatically:

- delete production tables
- truncate databases
- remove columns containing data
- reset production databases
- disable security policies
- weaken access controls

Before destructive schema changes, explain the impact and request confirmation.

---

## **15. Database migrations must be reversible**

When database migrations are introduced:

- use version controlled migrations
- avoid manual production database editing
- describe migration impact
- maintain rollback options when practical

---

# **Coding workflow**

## **16. Before implementing a major feature**

First explain:

1. What you plan to build
2. Which files you plan to create or modify
3. Whether new dependencies are required
4. Security implications
5. Database implications
6. Whether the change affects existing architecture

Then wait for approval when the change is substantial.

---

## **17. Small changes are preferred**

Break large features into small working increments.

After each meaningful step:

- run TypeScript checks
- run lint
- verify the application still starts
- fix errors before continuing

Do not accumulate large amounts of broken code.

---

## **18. Do not rewrite working systems unnecessarily**

If working code already exists, modify only what is necessary.

Do not perform large refactors unless there is a clear benefit.

---

# **Folder architecture**

As the project grows, prefer an organisation broadly similar to:

```text
src/
  app/
  components/
  features/
  lib/
  server/
  services/
  types/
```

Possible responsibility:

```text
app
Routes and pages

components
Reusable UI components

features
Domain specific product functionality

lib
Shared utilities

server
Server only logic

services
Integrations with external systems

types
Shared TypeScript types
```

Do not create empty folders simply to satisfy this structure.

Create folders only when they become necessary.

---

# **Naming and readability**

Use descriptive names.

Prefer:

```text
caseSummary
legalIssue
userId
sourceCitation
resolutionOption
```

Avoid vague names such as:

```text
data
thing
obj
temp
stuff
```

unless the context makes their meaning obvious.

---

# **Error handling**

Never silently swallow important errors.

Errors exposed to users should be understandable without leaking:

- stack traces
- secrets
- database details
- internal architecture
- private identifiers

Log sufficient information on the server for debugging.

---

# **Privacy**

Collect only information necessary for the product.

Avoid storing unnecessary personally identifiable information.

Do not place sensitive user information in:

- analytics event names
- browser logs
- URLs
- query parameters
- public logs

---

# **Git discipline**

Never commit:

```text
.env
.env.local
API keys
passwords
access tokens
private certificates
database credentials
```

Before important architectural changes, maintain a clean Git state.

Use clear commit messages describing what changed.

---

# **Development behaviour for AI agents**

When working on Aram:

1. Inspect existing code before changing it.
2. Follow these instructions.
3. Do not guess about existing architecture.
4. Do not fabricate APIs or libraries.
5. Prefer official documentation when uncertain.
6. Explain major architectural decisions.
7. Preserve security boundaries.
8. Keep code understandable to a beginner.
9. Avoid premature optimisation.
10. Do not make destructive changes without explicit approval.

---

# **Current technology choices**

Unless explicitly changed by the project owner:

```text
Framework: Next.js
Language: TypeScript
UI styling: Tailwind CSS
Package manager: npm
Source control: Git
Repository: GitHub
IDE / AI coding environment: Cursor
```

Expected future integrations may include:

```text
Supabase
PostgreSQL
Anthropic Claude API
Legal retrieval / RAG
Vercel
```

Do not install these automatically.

They will be introduced deliberately when their architecture has been agreed upon.

---

# **Most important rule**

Aram handles legal problems involving real people.

Never optimise development speed at the expense of:

```text
Security
Privacy
Legal accuracy
Traceability
Data isolation
Maintainability
User trust
```

When uncertain, stop and explain the uncertainty before making a potentially risky change.