// Test script to verify NotificationCenter functionality
// This can be run in the browser console to test the component

console.log('🔔 NotificationCenter Test Script');

// Test data for notifications
const mockNotifications = [
    {
        id: '1',
        userId: 'test-user',
        title: 'Order Status Update',
        message: 'Your order #12345 has been shipped',
        type: 'order_status',
        orderId: 'order-123',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    },
    {
        id: '2',
        userId: 'test-user',
        title: 'New Comment',
        message: 'A new comment was added to your order',
        type: 'comment',
        orderId: 'order-456',
        commentId: 'comment-789',
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
        id: '3',
        userId: 'test-user',
        title: 'Task Assignment',
        message: 'You have been assigned to handle order #67890',
        type: 'assignment',
        orderId: 'order-789',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
    {
        id: '4',
        userId: 'test-user',
        title: 'Reminder',
        message: 'Don\'t forget to review pending orders',
        type: 'reminder',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    }
];

// Mock server action functions for testing
const mockServerActions = {
    onMarkAsRead: async (notificationId) => {
        console.log(`📖 Marking notification ${notificationId} as read`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        return { success: true };
    },
    
    onMarkAllAsRead: async () => {
        console.log('📖 Marking all notifications as read');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
    },
    
    onDeleteNotification: async (notificationId) => {
        console.log(`🗑️ Deleting notification ${notificationId}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    },
    
    onClearAll: async () => {
        console.log('🗑️ Clearing all notifications');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
    },
    
    onNavigateToOrder: (orderId) => {
        console.log(`🔗 Navigating to order ${orderId}`);
        // In a real app, this would navigate to the order page
    }
};

// Function to test notification center functionality
function testNotificationCenter() {
    console.log('🧪 Testing NotificationCenter Component');
    
    // Check if the notification bell is visible
    const notificationButton = document.querySelector('[data-testid="notification-button"]') || 
                              document.querySelector('button[aria-label*="notification"]') ||
                              document.querySelector('button:has(svg[data-lucide="bell"])');
    
    if (notificationButton) {
        console.log('✅ Notification button found');
        
        // Test clicking the notification button
        notificationButton.click();
        console.log('🖱️ Clicked notification button');
        
        setTimeout(() => {
            // Check if popover opened
            const popover = document.querySelector('[role="dialog"]') || 
                           document.querySelector('[data-radix-popper-content-wrapper]');
            
            if (popover) {
                console.log('✅ Notification popover opened');
                
                // Look for notification items
                const notificationItems = popover.querySelectorAll('[data-notification-id]') ||
                                        popover.querySelectorAll('.notification-item');
                
                console.log(`📋 Found ${notificationItems.length} notification items`);
                
                // Test action buttons
                const markAllButton = popover.querySelector('button:has(svg[data-lucide="check-check"])');
                const clearAllButton = popover.querySelector('button:has(svg[data-lucide="trash-2"])');
                
                if (markAllButton) console.log('✅ Mark all read button found');
                if (clearAllButton) console.log('✅ Clear all button found');
                
            } else {
                console.log('❌ Notification popover not found');
            }
        }, 100);
        
    } else {
        console.log('❌ Notification button not found');
        console.log('🔍 Available buttons:', document.querySelectorAll('button'));
    }
}

// Function to check component structure
function checkComponentStructure() {
    console.log('🏗️ Checking component structure...');
    
    // Check for required elements
    const checks = [
        { name: 'Bell icon', selector: 'svg[data-lucide="bell"], svg[data-lucide="bell-ring"]' },
        { name: 'Badge for count', selector: '.badge, [data-badge]' },
        { name: 'Popover trigger', selector: '[data-radix-popover-trigger]' },
    ];
    
    checks.forEach(check => {
        const element = document.querySelector(check.selector);
        console.log(`${element ? '✅' : '❌'} ${check.name}: ${element ? 'Found' : 'Not found'}`);
    });
}

// Export functions for manual testing
window.testNotificationCenter = testNotificationCenter;
window.checkComponentStructure = checkComponentStructure;
window.mockNotifications = mockNotifications;
window.mockServerActions = mockServerActions;

console.log('🚀 Test functions available:');
console.log('- testNotificationCenter(): Test the notification center functionality');
console.log('- checkComponentStructure(): Check if required elements are present');
console.log('- mockNotifications: Sample notification data');
console.log('- mockServerActions: Mock server action functions');
