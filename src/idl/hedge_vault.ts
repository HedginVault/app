/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hedge_vault.json`.
 */
export type HedgeVault = {
  "address": "r2ahBQ6gbPCJ9FxBymYcXuwXi8NmenRry7SE7QR7FAt",
  "metadata": {
    "name": "hedgeVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "adminAccept",
      "discriminator": [
        61,
        129,
        238,
        74,
        197,
        79,
        54,
        208
      ],
      "accounts": [
        {
          "name": "pendingAdmin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "configAddManager",
      "discriminator": [
        67,
        71,
        104,
        251,
        38,
        45,
        93,
        133
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "authority"
        },
        {
          "name": "manager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  110,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "configClaimPlatformFee",
      "discriminator": [
        215,
        119,
        58,
        3,
        206,
        229,
        46,
        11
      ],
      "accounts": [
        {
          "name": "treasuryAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "treasuryAuthorityShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryAuthority"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "configInitialize",
      "discriminator": [
        129,
        48,
        207,
        45,
        143,
        130,
        95,
        127
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "configInitializeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "configMigrate",
      "discriminator": [
        94,
        99,
        105,
        213,
        117,
        8,
        237,
        106
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "configPause",
      "discriminator": [
        217,
        42,
        85,
        11,
        91,
        202,
        36,
        130
      ],
      "accounts": [
        {
          "name": "guardian",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "configRemoveManager",
      "discriminator": [
        196,
        241,
        135,
        246,
        141,
        94,
        248,
        7
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "manager",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "configUpdate",
      "discriminator": [
        80,
        37,
        109,
        136,
        82,
        135,
        89,
        241
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "configUpdateArgs"
            }
          }
        }
      ]
    },
    {
      "name": "depositRequestCancel",
      "discriminator": [
        84,
        4,
        96,
        197,
        138,
        180,
        185,
        16
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositRequest",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "depositorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositRequestCreate",
      "discriminator": [
        175,
        29,
        37,
        184,
        7,
        77,
        15,
        238
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositor"
              }
            ]
          }
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint"
        },
        {
          "name": "depositorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositorShareTokenAccount",
          "docs": [
            "Created upfront so the request can be resolved permissionlessly."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositRequestReject",
      "discriminator": [
        113,
        13,
        54,
        175,
        88,
        232,
        135,
        39
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositor",
          "writable": true
        },
        {
          "name": "depositRequest",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "depositorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositRequestResolve",
      "discriminator": [
        142,
        130,
        96,
        79,
        107,
        196,
        216,
        176
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositor",
          "writable": true
        },
        {
          "name": "depositRequest",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "depositorShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "jupiterInitializeStrategy",
      "discriminator": [
        29,
        99,
        0,
        109,
        134,
        205,
        250,
        223
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  97,
                  116,
                  101,
                  103,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "destinationMint"
              }
            ]
          }
        },
        {
          "name": "destinationMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "jupiterSwap",
      "discriminator": [
        116,
        207,
        0,
        196,
        252,
        120,
        243,
        18
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault"
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "sourceMint"
        },
        {
          "name": "destinationMint"
        },
        {
          "name": "vaultSourceTokenAccount",
          "docs": [
            "Pinned to the vault's ATA so the deposit and share escrows can never be the source."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "sourceTokenProgram"
              },
              {
                "kind": "account",
                "path": "sourceMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultDestinationTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "destinationTokenProgram"
              },
              {
                "kind": "account",
                "path": "destinationMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sourceTokenProgram"
        },
        {
          "name": "destinationTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "eventAuthority",
          "address": "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf"
        },
        {
          "name": "jupiterProgram",
          "address": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
        }
      ],
      "args": [
        {
          "name": "swapData",
          "type": "bytes"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "slippageBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "meteoraDlmmAddLiquidity",
      "discriminator": [
        214,
        108,
        176,
        68,
        92,
        135,
        32,
        35
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault"
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "vaultTokenX",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenXProgram"
              },
              {
                "kind": "account",
                "path": "tokenXMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenY",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenYProgram"
              },
              {
                "kind": "account",
                "path": "tokenYMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "lbPair",
          "writable": true
        },
        {
          "name": "binArrayBitmapExtension",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveX",
          "writable": true
        },
        {
          "name": "reserveY",
          "writable": true
        },
        {
          "name": "tokenXMint"
        },
        {
          "name": "tokenYMint"
        },
        {
          "name": "tokenXProgram"
        },
        {
          "name": "tokenYProgram"
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "dlmmProgram",
          "address": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "meteoraDlmmAddLiquidityParams"
            }
          }
        }
      ]
    },
    {
      "name": "meteoraDlmmClaimFee",
      "discriminator": [
        78,
        116,
        98,
        78,
        50,
        82,
        72,
        37
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault"
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "vaultTokenX",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenXProgram"
              },
              {
                "kind": "account",
                "path": "tokenXMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenY",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenYProgram"
              },
              {
                "kind": "account",
                "path": "tokenYMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasuryAuthority"
        },
        {
          "name": "treasuryTokenX",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryAuthority"
              },
              {
                "kind": "account",
                "path": "tokenXProgram"
              },
              {
                "kind": "account",
                "path": "tokenXMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasuryTokenY",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryAuthority"
              },
              {
                "kind": "account",
                "path": "tokenYProgram"
              },
              {
                "kind": "account",
                "path": "tokenYMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "lbPair",
          "writable": true
        },
        {
          "name": "reserveX",
          "writable": true
        },
        {
          "name": "reserveY",
          "writable": true
        },
        {
          "name": "tokenXMint"
        },
        {
          "name": "tokenYMint"
        },
        {
          "name": "tokenXProgram"
        },
        {
          "name": "tokenYProgram"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "dlmmProgram",
          "address": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "remainingAccountsInfo",
          "type": {
            "defined": {
              "name": "remainingAccountsInfo"
            }
          }
        }
      ]
    },
    {
      "name": "meteoraDlmmInitializePosition",
      "discriminator": [
        223,
        94,
        215,
        96,
        175,
        181,
        195,
        204
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  97,
                  116,
                  101,
                  103,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "position"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "signer": true
        },
        {
          "name": "lbPair",
          "writable": true
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "dlmmProgram"
        }
      ],
      "args": [
        {
          "name": "lowerBinId",
          "type": "i32"
        },
        {
          "name": "upperBinId",
          "type": "i32"
        }
      ]
    },
    {
      "name": "meteoraDlmmRemoveLiquidity",
      "discriminator": [
        185,
        228,
        248,
        124,
        57,
        133,
        19,
        192
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault"
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "vaultTokenX",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenXProgram"
              },
              {
                "kind": "account",
                "path": "tokenXMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenY",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenYProgram"
              },
              {
                "kind": "account",
                "path": "tokenYMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "lbPair",
          "writable": true
        },
        {
          "name": "binArrayBitmapExtension",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveX",
          "writable": true
        },
        {
          "name": "reserveY",
          "writable": true
        },
        {
          "name": "tokenXMint"
        },
        {
          "name": "tokenYMint"
        },
        {
          "name": "tokenXProgram"
        },
        {
          "name": "tokenYProgram"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "dlmmProgram",
          "address": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "meteoraDlmmRemoveLiquidityParams"
            }
          }
        }
      ]
    },
    {
      "name": "navOverride",
      "discriminator": [
        64,
        177,
        154,
        150,
        27,
        191,
        22,
        94
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint"
        },
        {
          "name": "vaultTokenAccount",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositMintTokenProgram"
        }
      ],
      "args": [
        {
          "name": "totalAssets",
          "type": "u64"
        }
      ]
    },
    {
      "name": "navUpdate",
      "discriminator": [
        160,
        233,
        51,
        210,
        244,
        205,
        116,
        61
      ],
      "accounts": [
        {
          "name": "navUpdater",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint"
        },
        {
          "name": "vaultTokenAccount",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositMintTokenProgram"
        }
      ],
      "args": [
        {
          "name": "totalAssets",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vaultClaimManagerFee",
      "discriminator": [
        18,
        28,
        36,
        145,
        97,
        137,
        184,
        195
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "authorityShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "vaultClose",
      "discriminator": [
        81,
        73,
        155,
        182,
        37,
        130,
        252,
        91
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "shareEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "vaultCloseStrategy",
      "discriminator": [
        4,
        42,
        86,
        18,
        195,
        86,
        62,
        206
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "vaultInitialize",
      "discriminator": [
        164,
        192,
        189,
        148,
        250,
        255,
        120,
        250
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "manager"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "depositEscrow",
          "docs": [
            "Holds pending deposits until resolved."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "shareEscrow",
          "docs": [
            "Holds pending withdrawal shares until resolved."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "vaultInitializeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "vaultPause",
      "discriminator": [
        61,
        128,
        15,
        186,
        96,
        201,
        243,
        60
      ],
      "accounts": [
        {
          "name": "guardian",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "vaultUpdate",
      "discriminator": [
        128,
        43,
        102,
        9,
        194,
        204,
        17,
        133
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "vaultUpdateArgs"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawalRequestCancel",
      "discriminator": [
        237,
        193,
        42,
        53,
        129,
        151,
        162,
        253
      ],
      "accounts": [
        {
          "name": "withdrawer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "withdrawalRequest",
          "writable": true
        },
        {
          "name": "shareMint"
        },
        {
          "name": "withdrawerShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "shareEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawalRequestCreate",
      "discriminator": [
        193,
        105,
        100,
        175,
        230,
        216,
        84,
        246
      ],
      "accounts": [
        {
          "name": "withdrawer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "withdrawalRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "withdrawer"
              }
            ]
          }
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint"
        },
        {
          "name": "withdrawerShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "withdrawerTokenAccount",
          "docs": [
            "Created upfront so the request can be resolved permissionlessly."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "shareEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawalRequestReject",
      "discriminator": [
        229,
        19,
        254,
        250,
        208,
        152,
        36,
        0
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "withdrawer",
          "writable": true
        },
        {
          "name": "withdrawalRequest",
          "writable": true
        },
        {
          "name": "shareMint"
        },
        {
          "name": "withdrawerShareTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "shareTokenProgram"
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "shareEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawalRequestResolve",
      "discriminator": [
        176,
        218,
        60,
        55,
        25,
        158,
        8,
        133
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "withdrawer",
          "writable": true
        },
        {
          "name": "withdrawalRequest",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "withdrawerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "depositMintTokenProgram"
              },
              {
                "kind": "account",
                "path": "depositMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "shareEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "depositMintTokenProgram"
        },
        {
          "name": "shareTokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "depositRequest",
      "discriminator": [
        86,
        27,
        56,
        8,
        25,
        62,
        62,
        243
      ]
    },
    {
      "name": "manager",
      "discriminator": [
        221,
        78,
        171,
        233,
        213,
        142,
        113,
        56
      ]
    },
    {
      "name": "positionV2",
      "discriminator": [
        117,
        176,
        212,
        199,
        245,
        180,
        133,
        182
      ]
    },
    {
      "name": "strategy",
      "discriminator": [
        174,
        110,
        39,
        119,
        82,
        106,
        169,
        102
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "withdrawalRequest",
      "discriminator": [
        242,
        88,
        147,
        173,
        182,
        62,
        229,
        193
      ]
    }
  ],
  "events": [
    {
      "name": "adminAccepted",
      "discriminator": [
        174,
        12,
        76,
        139,
        158,
        99,
        110,
        254
      ]
    },
    {
      "name": "adminNominated",
      "discriminator": [
        22,
        247,
        53,
        33,
        59,
        59,
        68,
        112
      ]
    },
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "configMigrated",
      "discriminator": [
        115,
        69,
        99,
        100,
        192,
        77,
        40,
        50
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "depositCancelled",
      "discriminator": [
        233,
        23,
        42,
        206,
        203,
        207,
        147,
        35
      ]
    },
    {
      "name": "depositRejected",
      "discriminator": [
        142,
        2,
        235,
        2,
        171,
        247,
        250,
        10
      ]
    },
    {
      "name": "depositRequested",
      "discriminator": [
        35,
        33,
        229,
        138,
        116,
        238,
        192,
        22
      ]
    },
    {
      "name": "depositResolved",
      "discriminator": [
        216,
        235,
        58,
        75,
        83,
        136,
        113,
        227
      ]
    },
    {
      "name": "jupiterSwapped",
      "discriminator": [
        239,
        53,
        117,
        117,
        250,
        201,
        183,
        8
      ]
    },
    {
      "name": "managerAdded",
      "discriminator": [
        247,
        109,
        115,
        63,
        146,
        116,
        41,
        135
      ]
    },
    {
      "name": "managerFeeClaimed",
      "discriminator": [
        242,
        234,
        59,
        70,
        44,
        77,
        41,
        66
      ]
    },
    {
      "name": "managerRemoved",
      "discriminator": [
        66,
        207,
        129,
        195,
        19,
        142,
        75,
        244
      ]
    },
    {
      "name": "meteoraDlmmFeeClaimed",
      "discriminator": [
        164,
        135,
        44,
        23,
        232,
        212,
        45,
        232
      ]
    },
    {
      "name": "meteoraDlmmLiquidityAdded",
      "discriminator": [
        93,
        143,
        20,
        62,
        126,
        36,
        99,
        25
      ]
    },
    {
      "name": "meteoraDlmmLiquidityRemoved",
      "discriminator": [
        2,
        49,
        227,
        227,
        123,
        30,
        243,
        144
      ]
    },
    {
      "name": "navUpdated",
      "discriminator": [
        182,
        153,
        142,
        26,
        205,
        24,
        110,
        154
      ]
    },
    {
      "name": "platformFeeClaimed",
      "discriminator": [
        11,
        13,
        236,
        247,
        101,
        255,
        94,
        243
      ]
    },
    {
      "name": "protocolPaused",
      "discriminator": [
        35,
        111,
        245,
        138,
        237,
        199,
        79,
        223
      ]
    },
    {
      "name": "strategyClosed",
      "discriminator": [
        168,
        163,
        135,
        255,
        218,
        189,
        204,
        196
      ]
    },
    {
      "name": "strategyInitialized",
      "discriminator": [
        154,
        42,
        211,
        241,
        56,
        30,
        246,
        99
      ]
    },
    {
      "name": "vaultClosed",
      "discriminator": [
        238,
        129,
        38,
        228,
        227,
        118,
        249,
        215
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "vaultPaused",
      "discriminator": [
        198,
        157,
        22,
        151,
        68,
        100,
        162,
        35
      ]
    },
    {
      "name": "vaultUpdated",
      "discriminator": [
        93,
        187,
        145,
        216,
        134,
        201,
        3,
        105
      ]
    },
    {
      "name": "withdrawalCancelled",
      "discriminator": [
        119,
        175,
        207,
        80,
        186,
        237,
        229,
        9
      ]
    },
    {
      "name": "withdrawalRejected",
      "discriminator": [
        44,
        169,
        123,
        79,
        197,
        74,
        90,
        230
      ]
    },
    {
      "name": "withdrawalRequested",
      "discriminator": [
        75,
        207,
        21,
        12,
        160,
        102,
        150,
        55
      ]
    },
    {
      "name": "withdrawalResolved",
      "discriminator": [
        202,
        37,
        47,
        142,
        92,
        145,
        146,
        145
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidProgramId",
      "msg": "Invalid Program"
    },
    {
      "code": 6001,
      "name": "invalidPubkey",
      "msg": "Pubkey cannot be the default pubkey"
    },
    {
      "code": 6002,
      "name": "invalidTransferAmount",
      "msg": "Transfer amount must be greater than zero"
    },
    {
      "code": 6003,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6004,
      "name": "conversionFailed",
      "msg": "Math conversion failed"
    },
    {
      "code": 6005,
      "name": "invalidBasisPoints",
      "msg": "Basis points cannot exceed 10,000"
    },
    {
      "code": 6006,
      "name": "invalidRemainingAccounts",
      "msg": "Invalid amount of remaining accounts passed"
    },
    {
      "code": 6007,
      "name": "invalidInstructionData",
      "msg": "Instruction data is malformed"
    },
    {
      "code": 6008,
      "name": "invalidMinimumAmount",
      "msg": "Minimum deposit and withdrawal amounts must be greater than zero"
    },
    {
      "code": 6009,
      "name": "invalidTokenAccountMint",
      "msg": "Invalid Token Account Mint"
    },
    {
      "code": 6010,
      "name": "invalidTokenAccountOwner",
      "msg": "Invalid Token Account Owner"
    },
    {
      "code": 6011,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6012,
      "name": "invalidTokenProgram",
      "msg": "Token program is not a supported SPL token program"
    },
    {
      "code": 6013,
      "name": "invalidConfig",
      "msg": "Config address does not match"
    },
    {
      "code": 6014,
      "name": "invalidConfigVersion",
      "msg": "Config layout is not the expected version for this migration"
    },
    {
      "code": 6015,
      "name": "invalidAdmin",
      "msg": "Admin does not match"
    },
    {
      "code": 6016,
      "name": "invalidNavUpdater",
      "msg": "NAV updater does not match"
    },
    {
      "code": 6017,
      "name": "invalidTreasuryAuthority",
      "msg": "Treasury authority does not match"
    },
    {
      "code": 6018,
      "name": "invalidGuardian",
      "msg": "Guardian does not match"
    },
    {
      "code": 6019,
      "name": "invalidPendingAdmin",
      "msg": "Signer is not the pending admin"
    },
    {
      "code": 6020,
      "name": "protocolNotOperational",
      "msg": "Protocol is paused or in reduce-only status"
    },
    {
      "code": 6021,
      "name": "protocolNotWithdrawable",
      "msg": "Protocol is not in a withdrawable status"
    },
    {
      "code": 6022,
      "name": "invalidManager",
      "msg": "Manager address does not match"
    },
    {
      "code": 6023,
      "name": "invalidManagerAuthority",
      "msg": "Manager authority does not match"
    },
    {
      "code": 6024,
      "name": "invalidVault",
      "msg": "Vault address does not match"
    },
    {
      "code": 6025,
      "name": "invalidVaultAuthority",
      "msg": "Vault authority does not match"
    },
    {
      "code": 6026,
      "name": "vaultNotOperational",
      "msg": "Vault is paused or in reduce-only status"
    },
    {
      "code": 6027,
      "name": "vaultNotWithdrawable",
      "msg": "Vault is not in a withdrawable status"
    },
    {
      "code": 6028,
      "name": "depositCapReached",
      "msg": "Deposit cap for the vault has been reached"
    },
    {
      "code": 6029,
      "name": "invalidDepositMint",
      "msg": "Deposit mint does not match"
    },
    {
      "code": 6030,
      "name": "invalidShareMint",
      "msg": "Share mint does not match"
    },
    {
      "code": 6031,
      "name": "vaultHasOutstandingShares",
      "msg": "Vault cannot be closed until all shares are redeemed"
    },
    {
      "code": 6032,
      "name": "vaultHasPendingRequests",
      "msg": "Vault cannot be closed until all pending requests are resolved"
    },
    {
      "code": 6033,
      "name": "vaultHasUnclaimedFees",
      "msg": "Vault cannot be closed until all fee shares are claimed"
    },
    {
      "code": 6034,
      "name": "vaultHasOpenStrategies",
      "msg": "Vault cannot be closed until all strategies are closed"
    },
    {
      "code": 6035,
      "name": "vaultHasAssets",
      "msg": "Vault cannot be closed until its total assets are zero"
    },
    {
      "code": 6036,
      "name": "invalidSharesAmount",
      "msg": "Shares amount must be greater than zero"
    },
    {
      "code": 6037,
      "name": "noFeeToClaim",
      "msg": "Unclaimed fee shares is 0"
    },
    {
      "code": 6038,
      "name": "invalidDepositMintExtension",
      "msg": "Deposit mint has a Token-2022 extension the vault does not support"
    },
    {
      "code": 6039,
      "name": "vaultNavIsZero",
      "msg": "Vault NAV is zero, deposits are closed until NAV is restored"
    },
    {
      "code": 6040,
      "name": "depositBelowMinimum",
      "msg": "Deposit is below the vault minimum"
    },
    {
      "code": 6041,
      "name": "withdrawalBelowMinimum",
      "msg": "Withdrawal is below the vault minimum and is not the full share balance"
    },
    {
      "code": 6042,
      "name": "navAlreadyUpdatedThisEpoch",
      "msg": "NAV has already been updated for the current epoch"
    },
    {
      "code": 6043,
      "name": "feeExceedsTotalAssets",
      "msg": "Total fee cannot exceed total assets"
    },
    {
      "code": 6044,
      "name": "navDeviationExceeded",
      "msg": "NAV change exceeds the max deviation allowed per update"
    },
    {
      "code": 6045,
      "name": "totalAssetsBelowIdleBalance",
      "msg": "Total assets cannot be lower than the vault's idle balance"
    },
    {
      "code": 6046,
      "name": "epochOutflowCapReached",
      "msg": "Withdrawals resolved this epoch have reached the outflow cap"
    },
    {
      "code": 6047,
      "name": "invalidRequest",
      "msg": "Request address does not match"
    },
    {
      "code": 6048,
      "name": "invalidRequestAuthority",
      "msg": "Request authority does not match"
    },
    {
      "code": 6049,
      "name": "invalidRequestVault",
      "msg": "Request vault does not match"
    },
    {
      "code": 6050,
      "name": "pendingRequestNotResolved",
      "msg": "A request from a previous epoch is pending resolution"
    },
    {
      "code": 6051,
      "name": "requestNotResolvable",
      "msg": "Request cannot be resolved until NAV is updated in a later epoch"
    },
    {
      "code": 6052,
      "name": "requestNotCancellable",
      "msg": "Request can no longer be cancelled, it must be resolved"
    },
    {
      "code": 6053,
      "name": "zeroSharesMinted",
      "msg": "Deposit is too small to mint any shares at the current NAV"
    },
    {
      "code": 6054,
      "name": "invalidStrategy",
      "msg": "Strategy address does not match"
    },
    {
      "code": 6055,
      "name": "invalidStrategyType",
      "msg": "Strategy type is invalid for this operation"
    },
    {
      "code": 6056,
      "name": "invalidTargetMint",
      "msg": "Target mint does not match strategy target mint"
    },
    {
      "code": 6057,
      "name": "invalidStrategyMint",
      "msg": "Strategy mint cannot be the vault deposit or share mint"
    },
    {
      "code": 6058,
      "name": "invalidTargetMintTokenAccount",
      "msg": "Target mint of token account does not match"
    },
    {
      "code": 6059,
      "name": "invalidSwapMints",
      "msg": "Source and destination mint of a swap must differ"
    },
    {
      "code": 6060,
      "name": "slippageExceedsCap",
      "msg": "Swap slippage exceeds the protocol maximum"
    },
    {
      "code": 6061,
      "name": "swapOutputBelowMinimum",
      "msg": "Swap moved less than the quote and slippage cap allow"
    },
    {
      "code": 6062,
      "name": "invalidPosition",
      "msg": "Position address does not match"
    }
  ],
  "types": [
    {
      "name": "accountsType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "transferHookX"
          },
          {
            "name": "transferHookY"
          },
          {
            "name": "transferHookReward"
          },
          {
            "name": "transferHookMultiReward",
            "fields": [
              "u8"
            ]
          }
        ]
      }
    },
    {
      "name": "adminAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previousAdmin",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "adminNominated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "config",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Authority allowed to update config parameters and manage the manager whitelist."
            ],
            "type": "pubkey"
          },
          {
            "name": "navUpdater",
            "docs": [
              "Authority allowed to post vault NAV updates."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "docs": [
              "Authority allowed to claim platform fee shares."
            ],
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "docs": [
              "Authority allowed to pause the protocol, and nothing else."
            ],
            "type": "pubkey"
          },
          {
            "name": "nextVaultId",
            "docs": [
              "Vault ID, increments with each new vault."
            ],
            "type": "u64"
          },
          {
            "name": "platformPerformanceFeeBps",
            "docs": [
              "Fee taken from profits above the high water mark that goes to the platform, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "platformManagementFeeBps",
            "docs": [
              "Annualized fee taken on total assets that goes to the platform, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "maxNavDeviationBps",
            "docs": [
              "Max NAV per share change accepted from the updater in a single update, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "maxEpochOutflowBps",
            "docs": [
              "Max share of total assets that withdrawals can pay out per epoch, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "docs": [
              "Determines operational status of the protocol."
            ],
            "type": {
              "defined": {
                "name": "protocolStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding0",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "version",
            "docs": [
              "Layout version, see [CONFIG_VERSION]."
            ],
            "type": "u8"
          },
          {
            "name": "padding1",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "pendingAdmin",
            "docs": [
              "Admin nominated through `config_update`, becomes admin once it signs `admin_accept`. Default pubkey when none."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxSlippageBps",
            "docs": [
              "Max slippage accepted on a routed swap, denoted in basis points. Zero means [DEFAULT_MAX_SLIPPAGE_BPS]."
            ],
            "type": "u16"
          },
          {
            "name": "padding2",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "reserve",
            "type": {
              "array": [
                "u64",
                18
              ]
            }
          }
        ]
      }
    },
    {
      "name": "configInitializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "navUpdater",
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "platformPerformanceFeeBps",
            "type": "u16"
          },
          {
            "name": "platformManagementFeeBps",
            "type": "u16"
          },
          {
            "name": "maxNavDeviationBps",
            "type": "u16"
          },
          {
            "name": "maxEpochOutflowBps",
            "type": "u16"
          },
          {
            "name": "maxSlippageBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "navUpdater",
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configMigrated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configUpdateArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pendingAdmin",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "navUpdater",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "treasuryAuthority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "guardian",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "platformPerformanceFeeBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "platformManagementFeeBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maxNavDeviationBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maxEpochOutflowBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maxSlippageBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "status",
            "type": {
              "option": {
                "defined": {
                  "name": "protocolStatus"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "navUpdater",
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "platformPerformanceFeeBps",
            "type": "u16"
          },
          {
            "name": "platformManagementFeeBps",
            "type": "u16"
          },
          {
            "name": "maxNavDeviationBps",
            "type": "u16"
          },
          {
            "name": "maxEpochOutflowBps",
            "type": "u16"
          },
          {
            "name": "maxSlippageBps",
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "protocolStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "depositCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositRequest",
      "docs": [
        "Pending deposit, resolvable once the vault NAV is updated in a later epoch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Authority of the request, receives the minted shares."
            ],
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "The vault this request is for."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Deposit mint amount held in the vault's deposit escrow."
            ],
            "type": "u64"
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch the request was made in."
            ],
            "type": "u64"
          },
          {
            "name": "createdTs",
            "docs": [
              "Timestamp the request was created."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future fields."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "depositRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "pendingAmount",
            "type": "u64"
          },
          {
            "name": "epoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "navPerShare",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "feeInfo",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeXPerTokenComplete",
            "type": "u128"
          },
          {
            "name": "feeYPerTokenComplete",
            "type": "u128"
          },
          {
            "name": "feeXPending",
            "type": "u64"
          },
          {
            "name": "feeYPending",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "jupiterSwapped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "sourceMint",
            "type": "pubkey"
          },
          {
            "name": "destinationMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityParameterByStrategy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountX",
            "type": "u64"
          },
          {
            "name": "amountY",
            "type": "u64"
          },
          {
            "name": "activeId",
            "type": "i32"
          },
          {
            "name": "maxActiveBinSlippage",
            "type": "i32"
          },
          {
            "name": "strategyParameters",
            "type": {
              "defined": {
                "name": "strategyParameters"
              }
            }
          }
        ]
      }
    },
    {
      "name": "manager",
      "docs": [
        "Whitelist entry allowing `authority` to create vaults. Created and closed by the config admin."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Authority allowed to create vaults."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future fields."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "managerAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "managerFeeClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "managerRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "meteoraDlmmAddLiquidityParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidityParameter",
            "type": {
              "defined": {
                "name": "liquidityParameterByStrategy"
              }
            }
          },
          {
            "name": "remainingAccountsInfo",
            "type": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        ]
      }
    },
    {
      "name": "meteoraDlmmFeeClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "amountX",
            "docs": [
              "Total fees claimed into the vault, including the treasury share."
            ],
            "type": "u64"
          },
          {
            "name": "amountY",
            "type": "u64"
          },
          {
            "name": "treasuryAmountX",
            "type": "u64"
          },
          {
            "name": "treasuryAmountY",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "meteoraDlmmLiquidityAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "amountX",
            "type": "u64"
          },
          {
            "name": "amountY",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "meteoraDlmmLiquidityRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "bpsToRemove",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "meteoraDlmmRemoveLiquidityParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bpsToRemove",
            "docs": [
              "Portion of liquidity to remove across the full position range."
            ],
            "type": "u16"
          },
          {
            "name": "remainingAccountsInfo",
            "type": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        ]
      }
    },
    {
      "name": "navUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "totalAssets",
            "type": "u64"
          },
          {
            "name": "navPerShare",
            "type": "u64"
          },
          {
            "name": "highWaterMark",
            "type": "u64"
          },
          {
            "name": "managerFeeShares",
            "type": "u64"
          },
          {
            "name": "platformFeeShares",
            "type": "u64"
          },
          {
            "name": "overridden",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "platformFeeClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "positionV2",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lbPair",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "liquidityShares",
            "type": {
              "array": [
                "u128",
                70
              ]
            }
          },
          {
            "name": "rewardInfos",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "userRewardInfo"
                  }
                },
                70
              ]
            }
          },
          {
            "name": "feeInfos",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "feeInfo"
                  }
                },
                70
              ]
            }
          },
          {
            "name": "lowerBinId",
            "type": "i32"
          },
          {
            "name": "upperBinId",
            "type": "i32"
          },
          {
            "name": "lastUpdatedAt",
            "type": "i64"
          },
          {
            "name": "totalClaimedFeeXAmount",
            "type": "u64"
          },
          {
            "name": "totalClaimedFeeYAmount",
            "type": "u64"
          },
          {
            "name": "totalClaimedRewards",
            "type": {
              "array": [
                "u64",
                2
              ]
            }
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "lockReleasePoint",
            "type": "u64"
          },
          {
            "name": "padding0",
            "type": "u8"
          },
          {
            "name": "feeOwner",
            "type": "pubkey"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                87
              ]
            }
          }
        ]
      }
    },
    {
      "name": "protocolPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "guardian",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "protocolStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "normal"
          },
          {
            "name": "paused"
          },
          {
            "name": "reduceOnly"
          }
        ]
      }
    },
    {
      "name": "remainingAccountsInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slices",
            "type": {
              "vec": {
                "defined": {
                  "name": "remainingAccountsSlice"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "remainingAccountsSlice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accountsType",
            "type": {
              "defined": {
                "name": "accountsType"
              }
            }
          },
          {
            "name": "length",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "strategy",
      "docs": [
        "Record of where a vault's funds are utilized. Holds no accounting, NAV is tracked off-chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "The vault this strategy belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "createdTs",
            "docs": [
              "Timestamp the strategy was created."
            ],
            "type": "i64"
          },
          {
            "name": "lastActionTs",
            "docs": [
              "Timestamp of the last execute/exit on the strategy."
            ],
            "type": "i64"
          },
          {
            "name": "id",
            "docs": [
              "ID unique to the strategy within the vault."
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "docs": [
              "Layout version, see [STRATEGY_VERSION]."
            ],
            "type": "u8"
          },
          {
            "name": "padding0",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future fields, the enum has to stay last."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "strategyType",
            "docs": [
              "Details about the underlying protocol and action of the strategy."
            ],
            "type": {
              "defined": {
                "name": "hedge_vault::state::strategy::StrategyType"
              }
            }
          }
        ]
      }
    },
    {
      "name": "strategyClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "strategyInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "strategyType",
            "type": {
              "defined": {
                "name": "hedge_vault::state::strategy::StrategyType"
              }
            }
          }
        ]
      }
    },
    {
      "name": "strategyParameters",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minBinId",
            "type": "i32"
          },
          {
            "name": "maxBinId",
            "type": "i32"
          },
          {
            "name": "strategyType",
            "type": {
              "defined": {
                "name": "hedge_vault::dlmm::types::StrategyType"
              }
            }
          },
          {
            "name": "parameteres",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "userRewardInfo",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rewardPerTokenCompletes",
            "type": {
              "array": [
                "u128",
                2
              ]
            }
          },
          {
            "name": "rewardPendings",
            "type": {
              "array": [
                "u64",
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "vault",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "docs": [
              "Unique vault ID."
            ],
            "type": "u64"
          },
          {
            "name": "authority",
            "docs": [
              "Authority allowed to manage the vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Name of the vault (utf8 bytes, padded with 0s)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reservedKeys",
            "docs": [
              "80..144, reserved for two future `Pubkey` fields (e.g. `pending_authority`, `delegate`).",
              "Vault metadata beyond `name` lives off-chain."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "depositMint",
            "docs": [
              "Mint accepted as vault deposits."
            ],
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "docs": [
              "Mint of the tokenized vault shares, authority is the vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "depositCap",
            "docs": [
              "Max total assets accepted including pending deposits, denoted in deposit mint."
            ],
            "type": "u64"
          },
          {
            "name": "totalAssets",
            "docs": [
              "Last reported total value of vault holdings, adjusted on request resolution. Denoted in deposit mint."
            ],
            "type": "u64"
          },
          {
            "name": "navPerShare",
            "docs": [
              "Last recorded value of one share, scaled by [NAV_PRECISION]. Denoted in deposit mint."
            ],
            "type": "u64"
          },
          {
            "name": "highWaterMark",
            "docs": [
              "All-time highest recorded NAV per share after fees.",
              "",
              "Performance fees are only taken on profits above this mark."
            ],
            "type": "u64"
          },
          {
            "name": "navEpoch",
            "docs": [
              "Epoch of the last NAV update."
            ],
            "type": "u64"
          },
          {
            "name": "lastNavTs",
            "docs": [
              "Timestamp of the last NAV update, used to prorate management fees."
            ],
            "type": "i64"
          },
          {
            "name": "pendingDeposits",
            "docs": [
              "Total deposit mint held in deposit escrow awaiting resolution."
            ],
            "type": "u64"
          },
          {
            "name": "pendingWithdrawalShares",
            "docs": [
              "Total shares held in share escrow awaiting resolution."
            ],
            "type": "u64"
          },
          {
            "name": "unclaimedManagerFeeShares",
            "docs": [
              "Fee shares accrued to the vault manager, minted on claim."
            ],
            "type": "u64"
          },
          {
            "name": "unclaimedPlatformFeeShares",
            "docs": [
              "Fee shares accrued to the platform, minted on claim."
            ],
            "type": "u64"
          },
          {
            "name": "epochOutflow",
            "docs": [
              "Deposit mint paid out to withdrawals since the last NAV update."
            ],
            "type": "u64"
          },
          {
            "name": "nextStrategyId",
            "docs": [
              "Next strategy ID, increments with each new strategy."
            ],
            "type": "u32"
          },
          {
            "name": "performanceFeeBps",
            "docs": [
              "Fee taken from profits above the high water mark that goes to the vault manager, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "docs": [
              "Annualized fee taken on total assets that goes to the vault manager, denoted in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "docs": [
              "Determines operational status of the vault."
            ],
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "docs": [
              "Layout version, see [VAULT_VERSION]."
            ],
            "type": "u8"
          },
          {
            "name": "padding0",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          },
          {
            "name": "reserved0",
            "docs": [
              "312..320, reserved for `epoch_duration`."
            ],
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "minDeposit",
            "docs": [
              "Smallest deposit accepted per request, denoted in deposit mint. Zero disables the check."
            ],
            "type": "u64"
          },
          {
            "name": "minWithdrawalShares",
            "docs": [
              "Smallest shares accepted per withdrawal request unless it is the withdrawer's full balance. Zero disables the check."
            ],
            "type": "u64"
          },
          {
            "name": "reserved1",
            "docs": [
              "336..360, reserved for `last_override_ts`, `total_deposited`, `total_withdrawn`."
            ],
            "type": {
              "array": [
                "u8",
                24
              ]
            }
          },
          {
            "name": "feeEffectiveTs",
            "docs": [
              "Timestamp from which the pending fees apply, zero when no fee change is pending."
            ],
            "type": "i64"
          },
          {
            "name": "reserved2",
            "docs": [
              "368..380, reserved for `epoch_inflow` and per-vault deviation/outflow bps."
            ],
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "pendingPerformanceFeeBps",
            "docs": [
              "Performance fee that replaces [Vault::performance_fee_bps] once [Vault::fee_effective_ts] has passed."
            ],
            "type": "u16"
          },
          {
            "name": "pendingManagementFeeBps",
            "docs": [
              "Management fee that replaces [Vault::management_fee_bps] once [Vault::fee_effective_ts] has passed."
            ],
            "type": "u16"
          },
          {
            "name": "openStrategyCount",
            "docs": [
              "Strategies currently open on the vault, must be zero before the vault can be closed."
            ],
            "type": "u32"
          },
          {
            "name": "reserved3",
            "docs": [
              "388..424, reserved for `nav_update_count` and future fields."
            ],
            "type": {
              "array": [
                "u8",
                36
              ]
            }
          }
        ]
      }
    },
    {
      "name": "vaultClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultInitializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "performanceFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "depositCap",
            "type": "u64"
          },
          {
            "name": "minDeposit",
            "type": "u64"
          },
          {
            "name": "minWithdrawalShares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "depositMint",
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "normal"
          },
          {
            "name": "paused"
          },
          {
            "name": "reduceOnly"
          }
        ]
      }
    },
    {
      "name": "vaultUpdateArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "performanceFeeBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "managementFeeBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "depositCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "minDeposit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "minWithdrawalShares",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "status",
            "type": {
              "option": {
                "defined": {
                  "name": "vaultStatus"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "vaultUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "performanceFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "pendingPerformanceFeeBps",
            "type": "u16"
          },
          {
            "name": "pendingManagementFeeBps",
            "type": "u16"
          },
          {
            "name": "feeEffectiveTs",
            "type": "i64"
          },
          {
            "name": "depositCap",
            "type": "u64"
          },
          {
            "name": "minDeposit",
            "type": "u64"
          },
          {
            "name": "minWithdrawalShares",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "withdrawalCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawalRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawalRequest",
      "docs": [
        "Pending withdrawal, resolvable once the vault NAV is updated in a later epoch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Authority of the request, receives the redeemed deposit mint."
            ],
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "The vault this request is for."
            ],
            "type": "pubkey"
          },
          {
            "name": "shares",
            "docs": [
              "Shares held in the vault's share escrow."
            ],
            "type": "u64"
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch the request was made in."
            ],
            "type": "u64"
          },
          {
            "name": "createdTs",
            "docs": [
              "Timestamp the request was created."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future fields."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "withdrawalRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "pendingShares",
            "type": "u64"
          },
          {
            "name": "epoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawalResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "navPerShare",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "hedge_vault::dlmm::types::StrategyType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "spotOneSide"
          },
          {
            "name": "curveOneSide"
          },
          {
            "name": "bidAskOneSide"
          },
          {
            "name": "spotBalanced"
          },
          {
            "name": "curveBalanced"
          },
          {
            "name": "bidAskBalanced"
          },
          {
            "name": "spotImBalanced"
          },
          {
            "name": "curveImBalanced"
          },
          {
            "name": "bidAskImBalanced"
          }
        ]
      }
    },
    {
      "name": "hedge_vault::state::strategy::StrategyType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "jupiterSwap",
            "fields": [
              {
                "name": "targetMint",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "meteoraDlmm",
            "fields": [
              {
                "name": "position",
                "type": "pubkey"
              }
            ]
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "configVersion",
      "docs": [
        "Layout versions, bumped whenever an account grows. Zero means the pre-versioned layout."
      ],
      "type": "u8",
      "value": "2"
    },
    {
      "name": "defaultMaxSlippageBps",
      "docs": [
        "Max embedded Jupiter slippage accepted when [Config::max_slippage_bps] is unset (legacy zero)."
      ],
      "type": "u16",
      "value": "300"
    },
    {
      "name": "epochDuration",
      "docs": [
        "Duration of a NAV epoch in seconds. NAV is updated at most once per epoch."
      ],
      "type": "i64",
      "value": "86400"
    },
    {
      "name": "feeIncreaseDelay",
      "docs": [
        "Delay before a manager fee increase takes effect, so depositors can exit first."
      ],
      "type": "i64",
      "value": "604800"
    },
    {
      "name": "maxBps",
      "type": "u16",
      "value": "10000"
    },
    {
      "name": "navPrecision",
      "docs": [
        "Precision of NAV per share, 1e9 = 1 deposit mint unit per share."
      ],
      "type": "u64",
      "value": "1000000000"
    },
    {
      "name": "secondsPerYear",
      "docs": [
        "Used to prorate annualized management fees."
      ],
      "type": "i64",
      "value": "31536000"
    },
    {
      "name": "strategyVersion",
      "type": "u8",
      "value": "1"
    },
    {
      "name": "treasuryClaimFeeBps",
      "docs": [
        "Share of fees claimed from a protocol position that is sent to the treasury."
      ],
      "type": "u16",
      "value": "1000"
    },
    {
      "name": "vaultVersion",
      "type": "u8",
      "value": "1"
    }
  ]
};
