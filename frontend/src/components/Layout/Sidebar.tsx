import { useMemo, useState } from "react";
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const drawerWidth = 240;

type MenuItem = {
  label: string;
  path: string;
  roles?: string[];
  requiresFactory?: boolean;
  superAdminOnly?: boolean;
};

const baseMenuItems: MenuItem[] = [
  { label: "Dashboard", path: "/", requiresFactory: true },
  { label: "Activity log", path: "/activity", requiresFactory: true },
  { label: "Projects", path: "/projects", requiresFactory: true },
];

const wetCastingMenuItems: MenuItem[] = [
  { label: "Elements", path: "/elements", requiresFactory: true },
  { label: "Planner", path: "/planner", roles: ["planner", "admin"], requiresFactory: true },
  { label: "Production", path: "/production", roles: ["production", "admin"], requiresFactory: true },
];

const hollowcoreMenuItems: MenuItem[] = [
  { label: "Hollowcore Elements", path: "/hollowcore/elements", roles: ["planner", "admin"], requiresFactory: true },
  { label: "Hollowcore Planner", path: "/hollowcore/planner", roles: ["planner", "admin"], requiresFactory: true },
  { label: "Hollowcore Casts", path: "/hollowcore/casts", roles: ["planner", "admin"], requiresFactory: true },
  { label: "Hollowcore Beds", path: "/hollowcore/beds", roles: ["planner", "admin"], requiresFactory: true },
  { label: "Hollowcore Settings", path: "/hollowcore/settings", roles: ["planner", "admin"], requiresFactory: true },
];

const logisticsMenuItems: MenuItem[] = [
  { label: "QC", path: "/qc", roles: ["QC", "admin"], requiresFactory: true },
  { label: "Yard", path: "/yard", roles: ["yard", "admin"], requiresFactory: true },
  { label: "Yard Locations", path: "/yard-locations", roles: ["yard", "admin"], requiresFactory: true },
  { label: "Dispatch", path: "/dispatch", roles: ["dispatch", "admin"], requiresFactory: true },
];

const adminSupportMenuItems: MenuItem[] = [
  { label: "Mix Designs", path: "/mix-designs", requiresFactory: true },
  { label: "Moulds", path: "/moulds", requiresFactory: true },
  { label: "Reports", path: "/reports", requiresFactory: true },
  { label: "Users", path: "/users", roles: ["admin"] },
  { label: "Factories", path: "/factories", roles: ["admin"], superAdminOnly: true },
];

function canShowItem(item: MenuItem, role: string | undefined, factoryId: number | null | undefined) {
  if (item.superAdminOnly) return role === "admin" && factoryId === null;
  if (item.requiresFactory && factoryId === null) return false;
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export default function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const location = useLocation();
  const width = collapsed ? 0 : drawerWidth;
  const { user, loading } = useAuth();
  const [openSections, setOpenSections] = useState({
    wetCasting: true,
    hollowcore: true,
    logistics: true,
    adminSupport: true,
  });

  const visibleMenuItems = useMemo(() => {
    if (loading) {
      return {
        base: [],
        wetCasting: [],
        hollowcore: [],
        logistics: [],
        adminSupport: [],
      };
    }
    const role = user?.role;
    const factoryId = user?.factory_id;
    return {
      base: baseMenuItems.filter((item) => canShowItem(item, role, factoryId)),
      wetCasting: wetCastingMenuItems.filter((item) => canShowItem(item, role, factoryId)),
      hollowcore: hollowcoreMenuItems.filter((item) => canShowItem(item, role, factoryId)),
      logistics: logisticsMenuItems.filter((item) => canShowItem(item, role, factoryId)),
      adminSupport: adminSupportMenuItems.filter((item) => canShowItem(item, role, factoryId)),
    };
  }, [loading, user?.role, user?.factory_id]);

  const hasActivePath = (items: MenuItem[]) => items.some((item) => item.path === location.pathname);

  const renderNavItem = (item: MenuItem) => (
    <ListItemButton
      key={item.path}
      component={Link}
      to={item.path}
      selected={location.pathname === item.path}
      sx={{
        ml: 1.5,
        borderRadius: 1,
        "&.Mui-selected": {
          backgroundColor: "primary.main",
          color: "primary.contrastText",
        },
        "&.Mui-selected:hover": {
          backgroundColor: "primary.dark",
        },
        "& .MuiListItemText-primary": {
          fontWeight: location.pathname === item.path ? 800 : 650,
        },
      }}
    >
      <ListItemText primary={item.label} />
    </ListItemButton>
  );

  const renderSection = (key: keyof typeof openSections, label: string, items: MenuItem[]) => {
    if (!items.length) return null;
    const expanded = openSections[key] || hasActivePath(items);

    return (
      <Box key={key} sx={{ mb: 0.5 }}>
        <ListItemButton
          onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))}
          sx={{ borderRadius: 1 }}
        >
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontWeight: 700, color: "text.secondary", fontSize: 13 }}
          />
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </ListItemButton>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List disablePadding>{items.map((item) => renderNavItem(item))}</List>
        </Collapse>
      </Box>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          borderRightColor: collapsed ? "transparent" : "divider",
          backgroundImage: "none",
          overflowX: "hidden",
          transition: "width 150ms ease",
        },
      }}
    >
      <Toolbar />
      <Box sx={{ px: 2, pb: 1, display: collapsed ? "none" : "block" }}>
        <Typography variant="overline" color="text.secondary">
          Navigation
        </Typography>
      </Box>
      <Divider sx={{ mb: 1, display: collapsed ? "none" : "block" }} />
      <List sx={{ display: collapsed ? "none" : "block" }}>
        {visibleMenuItems.base.map((item) => renderNavItem(item))}
        {visibleMenuItems.base.length > 0 ? <Divider sx={{ my: 1 }} /> : null}
        {renderSection("wetCasting", "Wet Casting", visibleMenuItems.wetCasting)}
        {renderSection("hollowcore", "Hollowcore", visibleMenuItems.hollowcore)}
        {renderSection("logistics", "Logistics", visibleMenuItems.logistics)}
        {renderSection("adminSupport", "Admin / Support", visibleMenuItems.adminSupport)}
      </List>
    </Drawer>
  );
}

