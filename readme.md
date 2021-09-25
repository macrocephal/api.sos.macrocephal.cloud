# https://api.sos.macrocephal.cloud

Broadcast you need help, to willing people!

## Getting started

```shell
# Clone repository
git clone git@github.com:macrocephal/api.sos.macrocephal.cloud.git
# Move into repository folder
cd api.sos.macrocephal.cloud
# Intall project dependencies
yarn install
# Start project for development
yarn start:watch
```

## Supported

### Blood

So far, the project connects people needing blood and those opened to donate.

<details>
<summary markdown="span">
    Blood Donation
</summary>

A+ => A+, AB+
A- => A+, AB+, A-, AB-
B+ => B+, AB+
B- => B+, AB+, B-, AB-
AB+ => AB+
AB- => AB+, AB-
O+ => O+, A+, B+, AB+
O- => O+, A+, B+, AB+, O-, A-, B-, AB-
</details>

<details>
<summary markdown="span">
    Blood Reception
</summary>

O- => O-
O+ => O+, O-
A- => A-, O-
A+ => A+, O+, A-, O-
B- => B-, O-
B+ => B+, O+, B-, O-
AB- => AB-, O-
AB+ => AB+, O+, AB-, O-
</details>

## What's Next?

Inspect **src/conf/create-env.ts** to know which environment variables
are being used, and their default value, when provided.

Consider looking into [**known-issues.md**](known-issues.md)
before you start using the API, or open an issue.

Also check the OpenAPI documentation [on the offical website](https://api.sos.macrocephal.cloud).
