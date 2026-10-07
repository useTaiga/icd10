# Data attribution

This package contains the United States ICD-10-CM diagnosis classification
maintained by CDC/NCHS and distributed by CMS. It is not WHO's international
ICD-10 catalog or the ICD-10-PCS inpatient procedure classification.

Sources:

- [CMS ICD-10 release files](https://www.cms.gov/medicare/coding-billing/icd-10-codes)
- [CDC/NCHS ICD-10-CM releases](https://www.cdc.gov/nchs/icd/icd-10-cm/files.html)
- [CDC use of agency materials](https://www.cdc.gov/other/agencymaterials.html)

The MIT license covers the package's software. The source classification is
redistributed with attribution; the package does not claim ownership of it.
No CDC, CMS, or WHO affiliation or endorsement is implied.

Descriptions and validity flags are reproduced from the official full order
files. Dots are inserted after the third character of codes. Release metadata
records download URLs, archive and order-file SHA-256 hashes, and code counts.
The order-file validity flag is exposed as `billable`; it indicates a complete
code valid for submission, not coverage, payment, or clinical appropriateness.
