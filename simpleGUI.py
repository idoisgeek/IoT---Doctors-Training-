import sys
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                             QHBoxLayout, QPushButton, QLabel, QStackedWidget)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont


class CaseSelectorApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.current_case = None
        self.initUI()

    def initUI(self):
        # Set up the main window
        self.setWindowTitle('Case Selector')

        # Create stacked widget to manage different screens
        self.stacked_widget = QStackedWidget(self)
        self.setCentralWidget(self.stacked_widget)

        # Create main menu screen
        self.create_main_menu()

        # Create case view screen
        self.create_case_view()

        # Start with main menu
        self.stacked_widget.setCurrentIndex(0)

        # Set to full screen mode
        self.showFullScreen()

    def create_main_menu(self):
        main_menu = QWidget()
        layout = QVBoxLayout(main_menu)

        # Title
        title_label = QLabel('Case Selector')
        title_font = QFont()
        title_font.setPointSize(24)  # Larger font for fullscreen
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # Subtitle
        subtitle_label = QLabel('Select a case to view details')
        subtitle_font = QFont()
        subtitle_font.setPointSize(16)  # Larger font for fullscreen
        subtitle_label.setFont(subtitle_font)
        subtitle_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(subtitle_label)

        layout.addSpacing(40)  # More spacing for fullscreen

        # Create 10 case buttons (2 rows of 5)
        for row in range(2):
            button_row = QHBoxLayout()
            for col in range(5):
                case_num = row * 5 + col + 1
                button = QPushButton(f'Case {case_num}')
                button.setMinimumHeight(80)  # Larger buttons for fullscreen
                button.setMinimumWidth(150)
                button_font = QFont()
                button_font.setPointSize(14)  # Larger font for fullscreen
                button.setFont(button_font)
                # Store the case number as a property of the button
                button.case_number = case_num
                button.clicked.connect(self.select_case)
                button_row.addWidget(button)
            layout.addLayout(button_row)
            layout.addSpacing(20)  # Add spacing between rows

        layout.addStretch()

        # Button layout for exit and toggle buttons
        bottom_buttons = QHBoxLayout()

        # Toggle fullscreen button
        toggle_button = QPushButton('Exit Fullscreen')
        toggle_button.setMinimumHeight(60)
        toggle_button.setMinimumWidth(200)
        toggle_font = QFont()
        toggle_font.setPointSize(12)
        toggle_button.setFont(toggle_font)
        toggle_button.clicked.connect(self.toggle_fullscreen)
        bottom_buttons.addWidget(toggle_button)

        # Exit button
        exit_button = QPushButton('Exit')
        exit_button.setMinimumHeight(60)
        exit_button.setMinimumWidth(200)
        exit_button.setFont(toggle_font)
        exit_button.clicked.connect(self.close)
        bottom_buttons.addWidget(exit_button)

        layout.addLayout(bottom_buttons)

        # Add to stacked widget
        self.stacked_widget.addWidget(main_menu)

    def create_case_view(self):
        case_view = QWidget()
        layout = QVBoxLayout(case_view)

        # Case title
        self.case_title = QLabel('Case Details')
        title_font = QFont()
        title_font.setPointSize(24)  # Larger font for fullscreen
        title_font.setBold(True)
        self.case_title.setFont(title_font)
        self.case_title.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.case_title)

        # Case information
        self.case_info = QLabel()
        info_font = QFont()
        info_font.setPointSize(18)  # Larger font for fullscreen
        self.case_info.setFont(info_font)
        self.case_info.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.case_info)

        layout.addStretch()

        # Return to main menu button
        return_button = QPushButton('Return to Main Menu')
        return_button.setMinimumHeight(60)
        return_button.setMinimumWidth(300)
        button_font = QFont()
        button_font.setPointSize(14)
        return_button.setFont(button_font)
        return_button.clicked.connect(self.return_to_menu)
        layout.addWidget(return_button, 0, Qt.AlignCenter)

        # Add to stacked widget
        self.stacked_widget.addWidget(case_view)

    def select_case(self):
        sender = self.sender()
        self.current_case = sender.case_number

        # Update case view with selected case information
        self.case_title.setText(f'Case {self.current_case}')
        self.case_info.setText(f'You selected Case {self.current_case}.\n\n'
                               f'This is the information for Case {self.current_case}.\n'
                               f'Additional details would be displayed here.')

        # Switch to case view
        self.stacked_widget.setCurrentIndex(1)

    def return_to_menu(self):
        # Switch back to main menu
        self.stacked_widget.setCurrentIndex(0)

    def toggle_fullscreen(self):
        if self.isFullScreen():
            self.showNormal()
            # Find and update the toggle button text
            for child in self.findChildren(QPushButton):
                if 'fullscreen' in child.text().lower():
                    child.setText('Enter Fullscreen')
                    break
        else:
            self.showFullScreen()
            # Find and update the toggle button text
            for child in self.findChildren(QPushButton):
                if 'fullscreen' in child.text().lower():
                    child.setText('Exit Fullscreen')
                    break

    def keyPressEvent(self, event):
        # Handle ESC key to exit fullscreen
        if event.key() == Qt.Key_Escape:
            if self.isFullScreen():
                self.showNormal()
                # Find and update the toggle button text
                for child in self.findChildren(QPushButton):
                    if 'fullscreen' in child.text().lower():
                        child.setText('Enter Fullscreen')
                        break
        else:
            super().keyPressEvent(event)


def main():
    app = QApplication(sys.argv)
    window = CaseSelectorApp()
    window.show()
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()