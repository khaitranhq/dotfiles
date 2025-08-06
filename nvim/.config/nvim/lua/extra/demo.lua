-- demo.lua
-- Demonstration script for nui UI components
-- This file contains examples of how to use the enhanced vim.ui functions

local M = {}

-- Demo function to showcase input dialog
function M.demo_input()
	vim.ui.input({
		prompt = "What's your favorite programming language? ",
		default = "Lua",
	}, function(input)
		if input and input ~= "" then
			vim.notify("Great choice! " .. input .. " is awesome! 🚀", vim.log.levels.INFO, {
				title = "Programming Language",
			})
		else
			vim.notify("No input provided", vim.log.levels.WARN)
		end
	end)
end

-- Demo function to showcase selection menu
function M.demo_select()
	local options = {
		{ name = "Create new file", icon = "📄", action = "create_file" },
		{ name = "Open recent file", icon = "📂", action = "recent_file" },
		{ name = "Search in project", icon = "🔍", action = "search" },
		{ name = "Run tests", icon = "🧪", action = "test" },
		{ name = "Build project", icon = "🔨", action = "build" },
		{ name = "Deploy", icon = "🚀", action = "deploy" },
	}

	vim.ui.select(options, {
		prompt = "Choose an action:",
		format_item = function(item)
			return item.icon .. " " .. item.name
		end,
	}, function(choice, idx)
		if choice then
			vim.notify(
				"Executing: " .. choice.name .. " (action: " .. choice.action .. ")",
				vim.log.levels.INFO,
				{ title = "Action Selected" }
			)
		else
			vim.notify("No action selected", vim.log.levels.WARN)
		end
	end)
end

-- Demo function to showcase LSP-like code action menu
function M.demo_code_actions()
	local actions = {
		"Quick fix: Add missing import",
		"Refactor: Extract to function",
		"Refactor: Rename symbol",
		"Optimize: Remove unused imports",
		"Generate: Add documentation",
		"Format: Fix indentation",
	}

	vim.ui.select(actions, {
		prompt = "Available code actions:",
		format_item = function(item)
			-- Add an icon prefix to make it look more like real code actions
			local icon = "💡"
			if item:match("Quick fix") then
				icon = "🔧"
			elseif item:match("Refactor") then
				icon = "♻️"
			elseif item:match("Optimize") then
				icon = "⚡"
			elseif item:match("Generate") then
				icon = "📝"
			elseif item:match("Format") then
				icon = "✨"
			end
			return icon .. " " .. item
		end,
	}, function(choice, idx)
		if choice then
			vim.notify("Applied: " .. choice, vim.log.levels.INFO, {
				title = "Code Action",
			})
		end
	end)
end

-- Demo function for a multi-step wizard using both input and select
function M.demo_wizard()
	-- Step 1: Get project name
	vim.ui.input({
		prompt = "Project name: ",
		default = "my-awesome-project",
	}, function(project_name)
		if not project_name or project_name == "" then
			vim.notify("Wizard cancelled - no project name", vim.log.levels.WARN)
			return
		end

		-- Step 2: Select project type
		local project_types = {
			"Web Application (React/Vue)",
			"API Server (Node.js/Python)",
			"Desktop App (Electron/Tauri)",
			"Mobile App (React Native)",
			"CLI Tool (Go/Rust)",
			"Library/Package",
		}

		vim.ui.select(project_types, {
			prompt = "Project type:",
			format_item = function(item)
				return "📦 " .. item
			end,
		}, function(project_type, idx)
			if not project_type then
				vim.notify("Wizard cancelled - no project type", vim.log.levels.WARN)
				return
			end

			-- Step 3: Final confirmation
			local message = string.format("Create project '%s' of type '%s'?", project_name, project_type)

			vim.ui.select({ "Yes, create it!", "No, cancel" }, {
				prompt = message,
				format_item = function(item)
					local icon = item:match("Yes") and "✅" or "❌"
					return icon .. " " .. item
				end,
			}, function(confirm)
				if confirm and confirm:match("Yes") then
					vim.notify(
						"🎉 Project '" .. project_name .. "' created successfully!",
						vim.log.levels.INFO,
						{ title = "Project Created" }
					)
				else
					vim.notify("Project creation cancelled", vim.log.levels.WARN)
				end
			end)
		end)
	end)
end

-- Setup demo commands
function M.setup_commands()
	vim.api.nvim_create_user_command("DemoInput", M.demo_input, {
		desc = "Demo nui input dialog",
	})

	vim.api.nvim_create_user_command("DemoSelect", M.demo_select, {
		desc = "Demo nui selection menu",
	})

	vim.api.nvim_create_user_command("DemoCodeActions", M.demo_code_actions, {
		desc = "Demo LSP-style code actions menu",
	})

	vim.api.nvim_create_user_command("DemoWizard", M.demo_wizard, {
		desc = "Demo multi-step wizard with input and select",
	})
end

return M

