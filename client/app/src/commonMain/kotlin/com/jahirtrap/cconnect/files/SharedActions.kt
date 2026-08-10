package com.jahirtrap.cconnect.files

expect suspend fun downloadShared(url: String, filename: String): Boolean

expect suspend fun saveSharedAs(url: String, filename: String): Boolean

expect suspend fun openSharedExternally(url: String, filename: String): Boolean

expect suspend fun openSharedInBrowser(url: String, filename: String): Boolean

expect suspend fun saveAllShared(items: List<Pair<String, String>>): Boolean

expect suspend fun openAllSharedExternally(items: List<Pair<String, String>>): Boolean

expect suspend fun saveTextToDownloads(filename: String, text: String): Boolean

expect suspend fun saveTextAs(filename: String, text: String): Boolean

expect suspend fun shareText(filename: String, text: String): Boolean
