export const CHANNELS = {
  REPO_OPEN:  'git:repo:open',
  REPO_INFO:  'git:repo:info',
  REPO_CLONE: 'git:repo:clone',
  REPO_INIT:  'git:repo:init',

  LOG_GET:    'git:log:get',
  REFS_GET:   'git:refs:get',
  STATUS_GET: 'git:status:get',

  DIFF_COMMIT:  'git:diff:commit',
  DIFF_FILE:    'git:diff:file',
  DIFF_WORKING: 'git:diff:working',
  DIFF_STAGED:  'git:diff:staged',

  BRANCH_CHECKOUT: 'git:branch:checkout',
  BRANCH_CREATE:   'git:branch:create',
  BRANCH_DELETE:   'git:branch:delete',
  BRANCH_RENAME:   'git:branch:rename',
  BRANCH_MERGE:    'git:branch:merge',

  REMOTE_FETCH: 'git:remote:fetch',
  REMOTE_PULL:  'git:remote:pull',
  REMOTE_PUSH:  'git:remote:push',

  COMMIT_STAGE:       'git:commit:stage',
  COMMIT_UNSTAGE:     'git:commit:unstage',
  COMMIT_CREATE:      'git:commit:create',
  COMMIT_AMEND:       'git:commit:amend',
  COMMIT_DISCARD:     'git:commit:discard',
  COMMIT_REVERT:      'git:commit:revert',
  COMMIT_RESET:       'git:commit:reset',
  COMMIT_CHERRY_PICK: 'git:commit:cherry-pick',

  TAG_CREATE: 'git:tag:create',
  TAG_DELETE: 'git:tag:delete',
  TAG_PUSH:   'git:tag:push',

  STASH_SAVE:  'git:stash:save',
  STASH_APPLY: 'git:stash:apply',
  STASH_DROP:  'git:stash:drop',

  LOG_FILE:   'git:log:file',
  LOG_REFLOG: 'git:log:reflog',

  DIFF_BLAME: 'git:diff:blame',

  REMOTE_LIST:   'git:remote:list',
  REMOTE_ADD:    'git:remote:add',
  REMOTE_REMOVE: 'git:remote:remove',
  REMOTE_RENAME: 'git:remote:rename',
  REMOTE_PRUNE:  'git:remote:prune',

  BRANCH_REBASE:       'git:branch:rebase',
  BRANCH_REBASE_ABORT: 'git:branch:rebase-abort',

  CONFLICT_LIST:    'git:conflict:list',
  CONFLICT_RESOLVE: 'git:conflict:resolve',

  STAGE_HUNK:   'git:stage:hunk',
  UNSTAGE_HUNK: 'git:unstage:hunk',

  // Stash improvements
  STASH_POP:        'git:stash:pop',
  STASH_SAVE_FLAGS: 'git:stash:save-flags',
  STASH_LIST:       'git:stash:list',
  STASH_DIFF:       'git:stash:diff',

  // Compare
  DIFF_COMPARE: 'git:diff:compare',

  // Branch extras
  BRANCH_SET_UPSTREAM:    'git:branch:set-upstream',
  BRANCH_CHECKOUT_REMOTE: 'git:branch:checkout-remote',
  BRANCH_CHECKOUT_HASH:   'git:branch:checkout-hash',

  // Interactive rebase
  LOG_REBASE_COMMITS:  'git:log:rebase-commits',
  REBASE_INTERACTIVE:  'git:rebase:interactive',

  // Patch
  PATCH_FORMAT:         'git:patch:format',
  PATCH_APPLY:          'git:patch:apply',
  DIALOG_OPEN_DIR:      'git:dialog:open-dir',
  DIALOG_OPEN_FILE:     'git:dialog:open-file',

  // Submodules
  SUBMODULE_LIST:   'git:submodule:list',
  SUBMODULE_ADD:    'git:submodule:add',
  SUBMODULE_UPDATE: 'git:submodule:update',
  SUBMODULE_REMOVE: 'git:submodule:remove',

  // Clean
  REPO_CLEAN_DRY: 'git:repo:clean-dry',
  REPO_CLEAN:     'git:repo:clean',

  // .gitignore / .gitattributes
  REPO_READ_GITIGNORE:      'git:repo:read-gitignore',
  REPO_WRITE_GITIGNORE:     'git:repo:write-gitignore',
  REPO_ADD_GITIGNORE:       'git:repo:add-gitignore',
  REPO_READ_GITATTRIBUTES:  'git:repo:read-gitattributes',
  REPO_WRITE_GITATTRIBUTES: 'git:repo:write-gitattributes',

  // Theme
  THEME_GET:     'app:theme:get',
  THEME_SET:     'app:theme:set',
  THEME_CHANGED: 'app:theme:changed',

  // OS integration (main → renderer push)
  REPO_OPENED_FROM_OS: 'app:repo:opened-from-os',

  // Tier-3 features
  WORKTREE_LIST:    'git:worktree:list',
  WORKTREE_ADD:     'git:worktree:add',
  WORKTREE_REMOVE:  'git:worktree:remove',
  WORKTREE_PRUNE:   'git:worktree:prune',
  REPO_ARCHIVE:     'git:repo:archive',
  REPO_FSCK:        'git:repo:fsck',
  COMMIT_SIGNATURE: 'git:commit:signature',
  COMMIT_SIGN:      'git:commit:sign',
  REPO_READ_MAILMAP:  'git:repo:read-mailmap',
  REPO_WRITE_MAILMAP: 'git:repo:write-mailmap',
  SPARSE_GET: 'git:sparse:get',
  SPARSE_SET: 'git:sparse:set',
  CONFIG_LIST:  'git:config:list',
  CONFIG_GET:   'git:config:get',
  CONFIG_SET:   'git:config:set',
  CONFIG_UNSET: 'git:config:unset',
  DIALOG_SAVE_FILE: 'git:dialog:save-file',

  // Commit template + SSH keys (user-global, no repo)
  TEMPLATE_READ:  'app:template:read',
  TEMPLATE_WRITE: 'app:template:write',
  SSH_LIST:       'app:ssh:list',
  SSH_GENERATE:   'app:ssh:generate',

  // Window controls
  WINDOW_TOGGLE_MAXIMIZE: 'app:window:toggle-maximize',
  OPEN_EXTERNAL: 'app:open-external',

  // Auto-update
  UPDATE_CHECK:   'app:update:check',   // renderer → main: trigger a check
  UPDATE_INSTALL: 'app:update:install', // renderer → main: quit and install
  UPDATE_STATUS:  'app:update:status',  // main → renderer: push status changes
  UPDATE_MANUAL:  'app:update:manual',  // main → renderer: a user-initiated check began
} as const
