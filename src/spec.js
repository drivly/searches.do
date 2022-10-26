export const openapi_spec = {
	openapi: '3.0.0',
	info: {
		title: 'Text Search API',
		version: '1.0.0',
		license: {
			name: 'MIT',
			url: 'https://opensource.org/licenses/MIT'
		}
	},
	paths: {
		'/databases': {
			get: {
				summary: 'List all databases',
				responses: {
					200: {
						description: 'The list of databases',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										databases: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													id: {
														type: 'string'
													},
													name: {
														type: 'string'
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			},
			post: {
				summary: 'Create a new database',
				requestBody: {
					description: 'The name of the database to create',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									name: {
										type: 'string'
									}
								},
								required: ['name']
							}
						}
					}
				},
				responses: {
					200: {
						description: 'The newly created database',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										database: {
											type: 'object',
											properties: {
												id: {
													type: 'string'
												},
												name: {
													type: 'string'
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		},
		'/{databaseID}/documents': {
			post: {
				summary: 'Create a new document in the database',
				parameters: [
					{
						name: 'databaseID',
						in: 'path',
						required: true,
						description:
							'The ID of the database to create the document in',
						schema: {
							type: 'string'
						}
					}
				],
				requestBody: {
					description: 'The document to create',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									text: {
										type: 'string'
									},
									metadata: {
										type: 'object',
										properties: {
											tags: {
												type: 'array',
												items: {
													type: 'string'
												}
											}
										}
									}
								},
								required: ['text']
							}
						}
					}
				},
				responses: {
					200: {
						description: 'The newly created document',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										document: {
											type: 'object',
											properties: {
												id: {
													type: 'string'
												},
												text: {
													type: 'string'
												},
												metadata: {
													type: 'object',
													properties: {
														tags: {
															type: 'array',
															items: {
																type: 'string'
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		},
		'/{databaseID}/documents/{documentID}': {
			parameters: [
				{
					name: 'databaseID',
					in: 'path',
					required: true,
					description: 'The ID of the database to get documents from',
					schema: {
						type: 'string'
					}
				},
				{
					name: 'documentID',
					in: 'path',
					required: true,
					description: 'The ID of the document to get',
					schema: {
						type: 'string'
					}
				}
			],
			get: {
				summary: 'Get a document with a specific ID',
				responses: {
					200: {
						description: 'The requested document',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										document: {
											type: 'object',
											properties: {
												id: {
													type: 'string'
												},
												text: {
													type: 'string'
												},
												metadata: {
													type: 'object',
													properties: {
														tags: {
															type: 'array',
															items: {
																type: 'string'
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			},
			delete: {
				summary: 'Delete a document with a specific ID',
				responses: {
					200: {
						description: 'The deleted document',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										document: {
											type: 'object',
											properties: {
												id: {
													type: 'string'
												},
												text: {
													type: 'string'
												},
												metadata: {
													type: 'object',
													properties: {
														tags: {
															type: 'array',
															items: {
																type: 'string'
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					},
					404: {
						description: 'The requested document was not found',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										api: {
											type: 'string',
											enum: ['textsearch']
										},
										error: {
											type: 'object',
											properties: {
												code: {
													type: 'integer',
													enum: [404]
												},
												message: {
													type: 'string'
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}