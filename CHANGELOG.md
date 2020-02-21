# Changelog

February 18, 2020
* Version 1.8.0
	* Add GDPR compliant cookie warning
	* Implement login with ORCID ID
		* Logging in with an ORCID ID provides access to collaborative annotation functions
	* Implement collaborative annotation for read-write sessions
		* Clusters can now be annotated with controlloed vocabularies (via [EBI OLS](https://www.ebi.ac.uk/ols/index)) or free text.
		* Other users can vote on annotations
		* Once added, annotations can be searched by other users	
	* Expand config options
	* Decrease page size on marker tables for performance
	* Fix a bug in colors overflowing into other channels
	* Add legend on compare tab
	* Fix color indexing on compare tab
	* Enable legend for 'All Clusters'
	* Improve loading of looms when only one is required
	* Fix issue displaying targets of regulons without all metadata
	* Limit search results for single letter queries
	* Various other fixes and performance increases (See commit history)
	* Switch to path based store for active connections
		* This propagates changes to a file to all active connections (when triggered)

January 24, 2020
* Version 1.7.3
	* Fix a bug in storing current session

November 12, 2019
* Version 1.7.2
	* Fix bug Regulon tab not showing for loom files not containing otif-based and track-based regulons.
* Version 1.7.1
	* Fix display of regulon target gene occurrences with loom containing motif-based and track-based regulons.

November 9, 2019
* Version 1.7.0
	* Display the regulon target gene occurrences when running SCENIC in multi-runs mode.

October 21, 2019
* Version 1.6.0
	* Allow renaming of file hierarchy levels from frontend

October 9, 2019
* Version 1.5.0
	* Add functionality for renaming clusters from the frontend on read-write looms
	* Bump to loompy 3
	* Small read/write bug fixes

October 1, 2019
* Version 1.4.2
	* Autodetect dimensionality reductions from column attributes with 'pca', 'tsne' or 'umap' in the name. NOTE: Extracts first 2 dimensions from attributes with >=2 dimensions. Therefore 3D dimensions may appear in the list but will show as 2D.

September 28, 2019
* Version 1.4.1
	* Fix bug in the query results (clusters) when searching a cluster which the queried gene is a marker for.

August 1, 2019
* Version 1.4.0
	* Enabled searching of regulons via their targetted genes
	* Enabled searching of clusters by their marker genes
		* Loom files containing many clusters will now search slower as a result
	* General search space and search improvements
		* Only build search space once per file on load
			* Initial load times of a session may increase as a result, however time for searcing is halved as a result
		* Reordering of search results
		* Increased number of results returned when searching and enabled scroll bar
	* EXPERIMENTAL: Enabled searching genes linked to regions for scATAC-seq data
		* To enable this, a row attribute must be added called `linkedGene` containing a string of the gene linked to the region
	* Allow display of Aertslab v9 motifs


July 18, 2019
* Version 1.3.7
	* Enabled read only sessions on the backend for permanent sessions
		* Use by adding a tab-seperated value of either `ro` or `rw` to a session in Permanent_Sessions.txt in SCope config dir.
	* No longer open looms as `rw` all the time to prevent corruption when closing the server.
	* Converted logs from print statements to logging package.
	* Various small fixes and dependancy issues.
	* General code cleanup and PEP8 compliance changes
	

June 26, 2019
* Version 1.3.6
   * Allow for running in dev mode on AWS through `npm run scope-dev-aws` (useful for t2.micro AWS instance). See https://bit.ly/2XsunFh to start your own SCope instance running on AWS. Update related tutorials for AWS deployment. 

December 14, 2018
* Version 1.3.5
   * Update Apache config to deploy SCope on secure protocol (e.g.: HTTPS). Update related tutorials for AWS deployment.

November 16, 2018
* Version 1.3.4
   * Fix some installation bugs.
   * Fix bug Compare tab disabled when a .loom does not contain any meta data information (e.g.: annotations).

August 22, 2018
* Version 1.3.2
   * Fix bug downloading sub loom when parent loom is a public one.
   * Fix bug downloading sub loom when parent loom has been created with SCopeLoomR version < 0.0.5.6558.
* Version 1.3.1
   * Fix bug when cluster markers not present in .loom.
* Version 1.3.0
   * Add feature to download subset of looms. Currently it is only possible to subset the active loom based on cluster information.

August 10, 2018
* Version 1.2.1
   * Fix bug when trajectory data not well defined in .loom.

July 6, 2018

* Version 1.2.0
   * Add feature to display trajectory data in the viewer. Currently the only way we provide to add trajectory data to .loom files is through [SCopeLoomR](https://github.com/aertslab/SCopeLoomR/).

July 4, 2018

* Version 1.1.0
   * Add feature to display metrics in the viewer. Currently the only way we provide to add metrics to .loom files is through [SCopeLoomR](https://github.com/aertslab/SCopeLoomR/).
