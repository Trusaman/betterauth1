Hệ thống Quản lý Đơn hàng Đa cấp

Phiên bản: 1.0
Ngày tạo: 24/08/2025
1. Tổng quan và Mục tiêu

1.1. Giới thiệu
Dự án này nhằm xây dựng một hệ thống quản lý đơn hàng nội bộ (Order Management System - OMS) trên nền tảng web, sử dụng Next.js. Hệ thống được thiết kế để tối ưu hóa và minh bạch hóa quy trình xử lý đơn hàng, từ khâu khởi tạo bởi nhân viên kinh doanh cho đến khi giao hàng thành công, thông qua nhiều cấp phê duyệt của các bộ phận liên quan.

1.2. Mục tiêu dự án

    Tăng hiệu quả: Tự động hóa luồng công việc, giảm thời gian xử lý và phê duyệt một đơn hàng.

    Minh bạch hóa: Cung cấp một nguồn thông tin tập trung, cho phép tất cả các bên liên quan theo dõi trạng thái và lịch sử của đơn hàng một cách dễ dàng.

    Giảm thiểu sai sót: Chuẩn hóa quy trình, yêu cầu cung cấp lý do cho các quyết định từ chối hoặc yêu cầu chỉnh sửa, giúp hạn chế sai sót do giao tiếp thủ công.

    Cải thiện giao tiếp: Tích hợp các công cụ như bình luận và thông báo real-time để các bộ phận phối hợp nhịp nhàng.

2. Đối tượng Người dùng (User Personas)

Hệ thống có 4 vai trò người dùng chính:

    Nhân viên kinh doanh (Sales): Chịu trách nhiệm tạo, theo dõi và xử lý các vấn đề phát sinh của đơn hàng do mình tạo ra.

    Kế toán (Accountant): Chịu trách nhiệm kiểm tra, xác thực tính chính xác về mặt tài chính, công nợ của đơn hàng trước khi cho phép xuất kho.

    Thủ kho (Warehouse Keeper): Chịu trách nhiệm xác nhận tình trạng tồn kho và chuẩn bị hàng hóa.

    Nhân viên giao hàng (Shipper): Chịu trách nhiệm nhận hàng và giao cho khách, đồng thời cập nhật kết quả giao hàng.

3. Quy trình và Yêu cầu Chức năng (Functional Requirements)

3.1. Luồng xử lý đơn hàng (Order Workflow)

Dưới đây là mô tả chi tiết các bước trong quy trình xử lý một đơn hàng:

Bước 1: Tạo và Gửi đơn hàng (Sales)

    Nhân viên kinh doanh (Sales) đăng nhập và tạo một đơn hàng mới.

    Yêu cầu:

        Mỗi đơn hàng được tạo sẽ có một ID đơn hàng duy nhất.

        Hệ thống tự động ghi nhận ID của người tạo (nhân viên Sales).

        Trong chi tiết đơn hàng, mỗi dòng sản phẩm phải được gắn với "Mã nhân viên" của Sales đó.

        Khi nhấn "Submit", đơn hàng sẽ chuyển sang trạng thái "Chờ kế toán duyệt" và gửi thông báo đến bộ phận Kế toán.

Bước 2: Kế toán Phê duyệt

    Kế toán nhận được thông báo và thấy đơn hàng trong danh sách cần xử lý.

    Yêu cầu:

        Kế toán có 3 lựa chọn:

            "Đồng ý": Đơn hàng chuyển trạng thái thành "Chờ thủ kho xác nhận" và gửi thông báo cho Thủ kho.

            "Đẩy lại để sửa": Đơn hàng chuyển trạng thái thành "Chờ để sửa". Kế toán bắt buộc phải nhập lý do. Hệ thống gửi thông báo kèm lý do cho Sales.

            "Từ chối": Đơn hàng chuyển trạng thái thành "Đã từ chối". Kế toán bắt buộc phải nhập lý do. Quy trình kết thúc.

Bước 3: Sales Chỉnh sửa hoặc Hủy đơn hàng

    Sales nhận được thông báo khi đơn hàng bị "Đẩy lại để sửa".

    Yêu cầu:

        Sales có thể chỉnh sửa thông tin đơn hàng. Mọi thay đổi phải được ghi lại trong lịch sử.

        Sau khi chỉnh sửa, Sales nhấn "Submit" để gửi lại cho Kế toán duyệt.

        Nếu không muốn tiếp tục, Sales có thể nhấn "Cancel" để hủy đơn hàng. Trạng thái đơn hàng chuyển thành "Đã hủy".

Bước 4: Thủ kho Xác nhận

    Thủ kho nhận được đơn hàng đã được Kế toán duyệt.

    Yêu cầu:

        Thủ kho kiểm tra kho và có 2 lựa chọn:

            "Đồng ý": Đơn hàng chuyển trạng thái thành "Chờ giao hàng" và gửi thông báo cho Nhân viên giao hàng.

            "Không đồng ý": Đơn hàng được đẩy ngược lại cho Sales (quay về trạng thái "Chờ để sửa"). Thủ kho bắt buộc phải ghi rõ nguyên nhân (ví dụ: "Hết hàng X").

Bước 5: Nhân viên giao hàng Cập nhật

    Nhân viên giao hàng nhận đơn và tiến hành giao.

    Yêu cầu:

        Sau khi giao xong, nhân viên có các lựa chọn:

            "Complete": Giao hàng thành công toàn bộ. Đơn hàng chuyển trạng thái thành "Hoàn thành". Quy trình kết thúc.

            "Partial Complete": Chỉ giao được một phần. Trạng thái chuyển thành "Giao hàng một phần". Đơn hàng được đẩy lại cho Kế toán. Nhân viên giao hàng phải nêu rõ lý do và chi tiết hàng đã giao/chưa giao.

            "Không hoàn thành": Khách hủy đơn hoặc không nhận hàng. Trạng thái chuyển thành "Không thành công". Đơn hàng được đẩy lại cho Sales. Nhân viên giao hàng phải nêu rõ lý do.

Bước 6: Xử lý các trường hợp đặc biệt

    Kế toán xử lý đơn "Partial Complete":

        Kế toán nhận lại đơn hàng, chỉnh sửa số lượng hàng và số tiền thực tế đã giao.

        Sau khi xác nhận, Kế toán nhấn nút "Partial Complete" cuối cùng, đơn hàng chuyển về trạng thái "Hoàn thành một phần" và kết thúc quy trình.

    Sales xử lý đơn "Không hoàn thành":

        Sales nhận lại đơn hàng và có 2 lựa chọn:

            Gửi lại đơn: Chỉnh sửa (nếu cần) và gửi lại cho Kế toán duyệt lại từ đầu.

            Hủy đơn: Nhấn nút "Hủy đơn" để kết thúc quy trình.

3.2. Các Tính năng Chung

    Lịch sử Đơn hàng (Order History):

        Mỗi đơn hàng phải có một tab/mục "Lịch sử" để theo dõi toàn bộ quá trình.

        Lịch sử cần ghi lại:

            Ai đã thực hiện hành động (tên người dùng và vai trò).

            Hành động là gì (tạo, duyệt, từ chối, sửa đổi, ...).

            Thời gian thực hiện.

            Nội dung chi tiết: Lý do từ chối/yêu cầu sửa, các trường dữ liệu đã thay đổi.

    Bình luận (Comments):

        Mỗi đơn hàng có một khu vực bình luận.

        Tất cả những người dùng có quyền truy cập vào đơn hàng đều có thể xem và viết bình luận để trao đổi thông tin.

        Bình luận phải hiển thị tên người viết và thời gian.

    Hệ thống Thông báo (Notification System):

        Hệ thống sẽ sử dụng Kafka để gửi các thông báo real-time.

        Khi trạng thái đơn hàng thay đổi, một sự kiện (event) sẽ được đẩy vào một topic Kafka tương ứng.

        Các service lắng nghe các topic này sẽ xử lý và gửi thông báo đến những người dùng có vai trò liên quan ở bước tiếp theo.

        Ví dụ: Khi Sales submit đơn, một event ORDER_SUBMITTED được tạo, service thông báo sẽ gửi notification cho tất cả user có role Accountant.

4. Yêu cầu Phi chức năng (Non-Functional Requirements)

    Công nghệ:

        Frontend: Next.js (React Framework).

        Backend: Node.js (Express.js/NestJS) hoặc một ngôn ngữ phù hợp khác.

        Cơ sở dữ liệu: PostgreSQL hoặc MongoDB.

        Real-time Messaging: Apache Kafka.

    Bảo mật:

        Triển khai cơ chế xác thực người dùng (Authentication) và phân quyền dựa trên vai trò (Role-Based Access Control - RBAC).

        Một người dùng chỉ có thể truy cập và thực hiện các chức năng được định nghĩa cho vai trò của mình.

    Hiệu năng:

        Giao diện người dùng phải có tốc độ phản hồi nhanh, tải trang dưới 3 giây.

        Hệ thống thông báo phải đảm bảo gửi tin nhắn gần như tức thì.

5. Thước đo Thành công (Success Metrics)

    Thời gian xử lý trung bình: Giảm 30% thời gian từ khi tạo đơn hàng đến khi đơn hàng được "Hoàn thành".

    Tỷ lệ sai sót: Giảm 50% số lượng đơn hàng phải "Đẩy lại để sửa" sau 3 tháng vận hành.

    Mức độ hài lòng của người dùng: Đạt điểm hài lòng trung bình từ 4/5 trở lên qua các cuộc khảo sát nội bộ hàng quý.