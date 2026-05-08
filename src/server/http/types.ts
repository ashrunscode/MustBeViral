import type { Env } from "../env";
import type { WorkspaceRole } from "../services/access";
import type { AuthContext } from "../services/auth/session";

export type AppVariables = {
	auth: AuthContext | undefined;
	requestId: string;
	workspaceId: string | undefined;
	workspaceRole: WorkspaceRole | undefined;
	brandId: string | undefined;
};

export type AppHonoContext = {
	Bindings: Env;
	Variables: AppVariables;
};
