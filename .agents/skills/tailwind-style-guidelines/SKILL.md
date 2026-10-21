---
name: tailwind-style-guidelines
description: Apply PureChatNext styling conventions when creating or migrating React components: prefer Tailwind for new and simple styles, retain createStaticStyles only for large, complex, animated, or dynamic CSS, and follow the project migration guide.
metadata:
  short-description: PureChatNext Tailwind-first styling rules
---

# PureChatNext Tailwind-first styling

Use this skill when creating a React component or changing its styles in PureChatNext.

## Required decisions

- New components default to Tailwind CSS classes.
- Do not add `createStaticStyles` for a few simple static declarations such as layout, spacing, color, border, radius, or basic responsive rules.
- Keep `createStaticStyles` when the style is genuinely complex or dynamic: multiple selectors/states, container queries, keyframes, SVG animation, custom scrollbar geometry, calculated values, or shared UI bridge behavior.
- Prefer semantic theme variables and direct public imports from `@lobehub/ui`; use `@pure/ui` for project-specific capabilities and do not add thin forwarding wrappers.
- Do not migrate `@pure/ui` internals as part of an unrelated business component change.
- If an exception is retained, leave a short reason near the style definition.

## Workflow

1. Read [the Lobe UI guidelines](../../../docs/development/styling/lobe-ui-guidelines.md) and inspect the component API before implementation.
2. Read [the style guidelines](../../../docs/development/styling/tailwind-guidelines.md) for component-level rules.
3. Read [the migration guide](../../../docs/development/styling/tailwind-migration.md) when converting existing styles.
4. Prefer the smallest change that keeps class names readable and preserves theme, responsive, and interaction behavior.
5. Remove unused style imports, style constants, and test mocks after a successful migration.
6. Run targeted ESLint and `pnpm exec tsc --noEmit` when the change is complete.

Do not treat zero remaining `createStaticStyles` usages as the goal. The goal is that new code is Tailwind-first and remaining CSS-in-JS has a concrete complexity or public-component reason.
