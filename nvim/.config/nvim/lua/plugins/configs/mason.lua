local M = {}

function M.install_package(package_name)
	local registry = require("mason-registry")
	local a = require("mason-core.async")

	local default_registry = "github:mason-org/mason-registry"
	registry.sources:append(default_registry)

	-- Use blocking refresh to ensure registry is fully loaded
	registry.refresh()

	-- Use pcall to safely handle "package not found" errors
	local ok, pkg = pcall(registry.get_package, package_name)
	if not ok then
		-- print("Warning: Cannot find package '" .. package_name .. "'")
		return
	end

	-- Install only if not already installed
	if not pkg:is_installed() then
		print("Installing " .. package_name)
		pkg:install():once("closed", function()
			print(package_name .. " installed successfully!")
		end)
	else
		-- print(package_name .. " is already installed")
	end
end

M.setup = function()
	require("mason").setup()
end

return M
