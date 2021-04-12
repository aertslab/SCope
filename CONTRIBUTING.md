# Contributing

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

## Pull Request Process

1. Ensure that linting and tests pass before submitting a PR.
1. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
1. You may merge the Pull Request in once you have the sign-off of one other developer.

## Client Style Guide

* All new files should be TypeScript.
* Each component (or related group of components) is placed in a logically named sub-directory of `components/`.
* Stateless function components are strongly preferred.
* All state should be stored in Redux _unless_ there is a good reason not to do so. This can be discussed in an issue or after a PR has been submitted..
* All side-effects should be performed through redux sagas. Components should not access the network **under any circumstances**.
* Each PR should be accompanied by tests and documentation (including a changelog entry if appropriate).
* New code should never `default export`.

## Server Style Guide
