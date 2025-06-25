# Galois

**version:** 0.0.2

This library implements a general-purpose Galois Field, GF(2^8) aka 256,
commonly used in cryptographic applications such as AES and Shamir Secret Sharing.

I plan to add a GF(2^16) aka 65536 implementation in the future.

# Installation & Usage

```
npm i @zytekaron/galois
```

```ts
import {GF256, Polynomials, Generators} from "@zytekaron/galois";

const gfAES = new GF256(); // defaults to AES polynomial and generator
const gfRS = new GF256(Polynomials.REED_SOLOMON, Generators.REED_SOLOMON);
```

# Compatible Libraries

- **Go:** [Zytekaron/galois-go](https://github.com/Zytekaron/galois-go)

# License

**galois-js** is licensed under the [MIT License](./LICENSE).
