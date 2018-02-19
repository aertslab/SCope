# regulons.AUC: regulons as rows, cell ids as columns
add_scenic_regulons_auc_matrix<-function(loom
                                       , regulons.AUC) {
  add_col_attr(loom = loom, key = "RegulonsAUC", value = as.data.frame(x = t(regulons.AUC)))
}

add_fbgn<-function(loom
                 , dgem
                 , fbgn.gn.mapping.file.path) {
  fbgn.gn.mapping<-read.table(file = fbgn.gn.mapping.file.path, header = F, sep = "\t", quote = '', stringsAsFactors = F)
  colnames(fbgn.gn.mapping)<-c("FBgn","Gene")
  genes<-merge(x = data.frame("Gene"=row.names(dgem)), y = fbgn.gn.mapping, by = "Gene")
  add_row_attr(loom = loom, key = "FBgn", value = genes$FBgn)
}

# Generic functions

add_row_attr<-function(loom
                     , key
                     , value) {
  grp.row.attrs<-loom[["row_attrs"]]
  grp.row.attrs[[key]]<-value
  loom$flush()
}

add_col_attr<-function(loom
                     , key
                     , value) {
  grp.col.attrs<-loom[["col_attrs"]]
  grp.col.attrs[[key]]<-value
  loom$flush()
}

add_matrix<-function(loom
                   , dgem) {
  row.names(dgem)<-NULL
  colnames(dgem)<-NULL
  loom[["matrix"]]<-t(dgem)
  loom$flush()
}

finalize<-function(loom) {
  loom$flush()
  loom$close_all()
}

build_loom<-function(file.name
                   , dgem
                   , embedding) {
  loom<-H5File$new(filename = file.name, mode = "w")
  cn<-colnames(dgem)
  rn<-row.names(dgem)
  # matrix
  print("Adding matrix...")
  add_matrix(loom = loom, dgem = t(dgem))
  # col_attrs
  print("Adding column attributes...")
  loom$create_group("col_attrs")
  add_col_attr(loom = loom, key = "CellID", value = as.character(cn))
  add_col_attr(loom = loom, key = "Embedding", value = as.data.frame(embedding))
  # row_attrs
  print("Adding row attributes...")
  loom$create_group("row_attrs")
  add_row_attr(loom = loom, key = "Gene", value = as.character(rn))
  add_fbgn(loom = loom, dgem = dgem)
  # col_edges
  print("Adding columns edges...")
  col.edges<-loom$create_group("col_edges")
  # row_edges
  print("Adding row edges...")
  row.edges<-loom$create_group("row_edges")
  # layers
  print("Adding layers...")
  layers<-loom$create_group("layers")
  loom$flush()
}