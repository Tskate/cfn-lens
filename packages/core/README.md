# @cfn-lens/core

Pure TypeScript (no DOM, no Node APIs): parses a CloudFormation template (YAML or JSON) into a typed model with diagnostics.

## Layout

| Folder        | What goes here                                                                                               | Knows about YAML? | Knows about a section? |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------- |
| `lib/`        | `parseTemplate` and one `read*` / `validate*` per template section (Parameters, Outputs, …)                  | `read*` only      | yes                    |
| `utils/yaml/` | Generic readers that take a YAML node, return our types and report diagnostics; `ParserContext`, `parseYaml` | yes               | no                     |
| `utils/`      | Plain functions over strings and values                                                                      | no                | no                     |
| `types/`      | The public model: `Template`, `Diagnostic`, section types                                                    | no                | —                      |
| `fixtures/`   | Test helpers (excluded from the build)                                                                       | —                 | —                      |

Rule of thumb: if it mentions a section by name, it's `lib/`; otherwise it's `utils/`, and `utils/yaml/` if it takes a YAML node.
