# SCope Utils

## R Environment

Utility file to create an .loom file in the R environment.

Dependencies: 
- hdf5r package

```
library(hdf5r)
source("https://github.com/aertslab/SCope/blob/master/scope-utils/loom_utils.R")
fn<-"toy.loom"
loom<-build_loom(file.name = fn, dgem = dgem, embedding = tsne)
add_scenic_regulons_auc_matrix(loom = loom, regulons.AUC = regulon.AUC)
finalize(loom)
```