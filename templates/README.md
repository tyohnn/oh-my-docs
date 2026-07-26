# Templates

`templates/default` is the canonical user scaffold copied by `oh-my-docs init`
(and packaged into `packages/cli/templates/default` on build).

`apps/docs` is the Oh My Docs product handbook for this repository. It is not
the user scaffold. Both share the same docs-first IA and `@oh-my-docs/ui` shape;
product content intentionally differs.

When you change `packages/docs-ui`, refresh the scaffold copy:

```bash
rm -rf templates/default/packages/docs-ui
cp -a packages/docs-ui templates/default/packages/docs-ui
rm -rf templates/default/packages/docs-ui/node_modules templates/default/packages/docs-ui/.turbo
```
