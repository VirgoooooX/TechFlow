// 管理员权限判断工具函数

// 管理员邮箱列表（可以根据需要扩展）
const ADMIN_EMAILS = [
  'admin@techflow.com',
  'administrator@techflow.com'
];

// 管理员用户ID列表（可以根据需要扩展）
const ADMIN_USER_IDS: string[] = [
  // 可以在这里添加特定的管理员用户ID
];

/**
 * 判断用户是否为管理员
 * @param user 用户对象
 * @returns 是否为管理员
 */
export const isAdmin = (user: any): boolean => {
  if (!user) return false;
  
  // 检查邮箱是否在管理员列表中
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return true;
  }
  
  // 检查用户ID是否在管理员列表中
  if (user.id && ADMIN_USER_IDS.includes(user.id)) {
    return true;
  }
  
  return false;
};

/**
 * 检查当前用户是否有管理员权限
 * @param user 用户对象
 * @returns 是否有管理员权限
 */
export const hasAdminPermission = (user: any): boolean => {
  return isAdmin(user);
};