# SKALE Skills

Collection of installable Agent Skills for SKALE Network workflows.

## Install

List skills available in this repo:

```bash
npx -y skills add skalenetwork/skills --list
```

Install one skill:

```bash
npx -y skills add skalenetwork/skills --skill about-skale
npx -y skills add skalenetwork/skills --skill deploy-to-skale
npx -y skills add skalenetwork/skills --skill build-with-bite
npx -y skills add skalenetwork/skills --skill x402-on-skale
npx -y skills add skalenetwork/skills --skill ima-bridging-on-skale
npx -y skills add skalenetwork/skills --skill skale-cli
```

Install all skills from this repo:

```bash
npx -y skills add skalenetwork/skills --skill '*' --agent '*' -y
```

## Available Skills

- `about-skale`: Learn about SKALE Network architecture, chain types, and gas models
- `deploy-to-skale`: Deploy contracts to SKALE chains with chain selection, RNG, bridge, and deployment setup
- `build-with-bite`: Build with BITE Protocol for privacy - encrypted transactions and confidential apps
- `x402-on-skale`: Build AI agents with x402 payments on SKALE - facilitator setup and payment middleware
- `ima-bridging-on-skale`: Programmatic IMA (Inter-chain Messaging Agent) bridging for SKALE chains
- `skale-cli`: Operational command playbooks for SKALE CLI usage

## Repository Structure

Installable skills live under `skills/` and follow the same nested model:

```text
skills/
  <skill>/
    SKILL.md        # dynamic discovery + linking root
    rules/          # must-follow constraints
    references/     # conceptual and lookup docs
    examples/       # concrete patterns and commands
    scripts/        # optional executable helpers
    agents/         # UI metadata
```

## Data Source Notes

- SKALE chain directory data: `skills/skale/references/chains.json`
   - source: <https://docs.skale.space/developers/integrate-skale/connect-to-skale.md>
- SKALE CLI command behavior reference: `~/projects/skale-cli/src`

## Migration Notes

Latest structure update:

- All skills now use nested `rules/`, `references/`, `examples/` with dynamic discovery in root `SKILL.md`.
